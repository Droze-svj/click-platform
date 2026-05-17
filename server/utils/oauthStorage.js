const logger = require('./logger');

/**
 * Shared storage utility for OAuth tokens with native multi-account support.
 *
 * Storage shape per platform:
 *   social_links.oauth.<platform> = {
 *     // Primary account (also mirrored as a backward-compat single-object
 *     // shape for code paths that haven't been migrated to multi-account)
 *     accessToken, refreshToken, platformUserId, platformUsername, ...,
 *
 *     // Full list of every connected account for this platform.
 *     accounts: [
 *       { accountId, platformUserId, accessToken, refreshToken,
 *         platformUsername, avatar, addedAt, isPrimary, ...extra },
 *       ...
 *     ],
 *
 *     // Per-flow OAuth state map so two concurrent connect flows don't
 *     // overwrite each other's state token. Cleaned up on consume.
 *     states: { '<state>': { createdAt, ... } },
 *
 *     // Convenience pointer to the active account for one-account UIs.
 *     activeAccountId: '<id>',
 *
 *     connected: true,
 *     connectedAt: <iso>,
 *   }
 *
 * Backward compatibility:
 *   - If a stored row has no `accounts[]` but does have `accessToken`,
 *     `loadTokens` synthesises a single-element `accounts[]` so newer
 *     code paths can iterate uniformly.
 *   - `saveTokens(userId, platform, data)` retains the old "merge into
 *     the primary blob" behaviour so legacy callers keep working. It
 *     ALSO upserts into `accounts[]` when `data.platformUserId` is
 *     present, matching by id.
 */
class OAuthStorage {
  static getProvider() {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.ENABLE_SUPABASE_AUTH === 'true') {
      return 'supabase';
    }
    return 'mongoose';
  }

  /**
   * Stable account id — prefers a real platform id when present, falls
   * back to a short random hex for first-connect flows that haven't
   * fetched the profile yet (later refreshed once we know the real id).
   */
  static _resolveAccountId(data) {
    return (
      data?.platformUserId ||
      data?.platform_user_id ||
      data?.userInfo?.id ||
      data?.profile?.id ||
      data?.id ||
      // Random fallback — caller can patch with the real id when known.
      require('crypto').randomBytes(8).toString('hex')
    );
  }

  // ── Supabase helpers ────────────────────────────────────────────────────
  static _supa() {
    const { createClient } = require('@supabase/supabase-js');
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }

  static async _readSupaPlatform(userId, platform) {
    const { data, error } = await this._supa()
      .from('users')
      .select('social_links')
      .eq('id', userId)
      .single();
    if (error) return null;
    const oauth = data?.social_links?.oauth || {};
    return { socialLinks: data?.social_links || {}, oauth, platformRow: oauth[platform] || null };
  }

  static async _writeSupaPlatform(userId, socialLinks, oauth, platform, nextRow) {
    const { error } = await this._supa()
      .from('users')
      .update({
        social_links: {
          ...socialLinks,
          oauth: {
            ...oauth,
            [platform]: nextRow,
          },
        },
      })
      .eq('id', userId);
    if (error) throw error;
  }

  // ── Mongoose helpers ────────────────────────────────────────────────────
  static async _readMongoPlatform(userId, platform) {
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) return null;
    const schemaPlatform = platform === 'google' ? 'youtube' : platform;
    return { user, schemaPlatform, platformRow: user.oauth?.[schemaPlatform] || null };
  }

  // ── Shape normalisation ─────────────────────────────────────────────────

  /**
   * Take a stored platform row (possibly old single-object shape) and
   * return a normalised view with an `accounts[]` array. Idempotent.
   */
  static _normalisePlatformRow(row) {
    if (!row || typeof row !== 'object') return null;
    if (Array.isArray(row.accounts) && row.accounts.length > 0) {
      return row;
    }
    // Synthesise accounts[] from the legacy single-blob shape so newer
    // callers can iterate uniformly. If there are no tokens at all, we
    // leave accounts empty — connected=false.
    const hasAuth = !!(row.accessToken || row.refreshToken);
    if (!hasAuth) return { ...row, accounts: [] };
    const id = row.platformUserId || row.platform_user_id || 'primary';
    return {
      ...row,
      accounts: [
        {
          accountId: id,
          platformUserId: id,
          platformUsername: row.platformUsername || row.username || null,
          accessToken: row.accessToken || null,
          refreshToken: row.refreshToken || null,
          avatar: row.avatar || null,
          metadata: row.metadata || null,
          expiresAt: row.expiresAt || null,
          addedAt: row.connectedAt || new Date().toISOString(),
          isPrimary: true,
          extra: row.extra || null,
        },
      ],
      activeAccountId: row.activeAccountId || id,
    };
  }

  /**
   * Upsert an account into accounts[] keyed by accountId/platformUserId.
   * Returns the modified row.
   */
  static _upsertAccount(row, accountData) {
    const accountId = this._resolveAccountId(accountData);
    const existing = Array.isArray(row.accounts) ? row.accounts.slice() : [];
    const idx = existing.findIndex((a) => (a.accountId === accountId) || (a.platformUserId && a.platformUserId === accountData.platformUserId));
    const merged = {
      ...((idx >= 0) ? existing[idx] : {}),
      ...accountData,
      accountId,
      platformUserId: accountData.platformUserId || existing[idx]?.platformUserId || accountId,
      addedAt: existing[idx]?.addedAt || new Date().toISOString(),
      isPrimary: existing.length === 0 || existing[idx]?.isPrimary || false,
    };
    if (idx >= 0) existing[idx] = merged;
    else existing.push(merged);
    // Active account defaults to primary if none set or current active was removed.
    let activeAccountId = row.activeAccountId || merged.accountId;
    if (!existing.some((a) => a.accountId === activeAccountId)) {
      activeAccountId = existing.find((a) => a.isPrimary)?.accountId || existing[0]?.accountId || null;
    }
    return {
      ...row,
      accounts: existing,
      activeAccountId,
      connected: existing.length > 0,
      connectedAt: row.connectedAt || new Date().toISOString(),
      // Mirror the primary account onto the row for legacy single-account
      // callers (they read accessToken/refreshToken/platformUserId off the
      // root). Keeps the migration zero-disruption.
      ...(() => {
        const primary = existing.find((a) => a.isPrimary) || existing[0];
        if (!primary) return {};
        return {
          accessToken: primary.accessToken || null,
          refreshToken: primary.refreshToken || null,
          platformUserId: primary.platformUserId,
          platformUsername: primary.platformUsername || row.platformUsername || null,
          avatar: primary.avatar || row.avatar || null,
          expiresAt: primary.expiresAt || null,
        };
      })(),
    };
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Save tokens for a user/platform. When `data.platformUserId` matches an
   * existing account in `accounts[]`, that account is updated; otherwise a
   * new one is appended. Legacy callers passing only `accessToken` etc.
   * still work — the primary account is updated in-place.
   */
  static async saveTokens(userId, platform, data) {
    const provider = this.getProvider();

    if (provider === 'supabase') {
      const ctx = await this._readSupaPlatform(userId, platform);
      if (!ctx) throw new Error('User row not found in Supabase');
      const normalised = this._normalisePlatformRow(ctx.platformRow) || { accounts: [] };

      // Path A — multi-account upsert (caller provided enough identity).
      const hasIdentity = !!(data.platformUserId || data.platform_user_id || data.userInfo?.id);
      // A row is "connected" only when at least one account holds real tokens.
      // State-only writes from `putState` (CSRF state for the redirect) must
      // NOT flip the flag — they used to, which left the dashboard claiming
      // the platform was connected after a click-and-cancel.
      const hasTokens = !!(data.accessToken || data.refreshToken);
      let nextRow;
      if (hasIdentity) {
        nextRow = this._upsertAccount(normalised, data);
      } else {
        // Path B — legacy "merge primary blob". Preserve accounts[] as-is
        // and the existing connectedness; only flip to true if tokens were
        // included in this write or we already had accounts on the row.
        const existingAccountsLen = Array.isArray(normalised.accounts) ? normalised.accounts.length : 0;
        nextRow = {
          ...normalised,
          ...data,
          connected: hasTokens || existingAccountsLen > 0 || !!normalised.connected,
          connectedAt: normalised.connectedAt || (hasTokens ? new Date().toISOString() : null),
        };
        // If there's a primary account, mirror token updates onto it so
        // refresh flows still update the right entry.
        if (Array.isArray(nextRow.accounts) && nextRow.accounts.length > 0 && (data.accessToken || data.refreshToken || data.expiresAt)) {
          const primaryIdx = nextRow.accounts.findIndex((a) => a.isPrimary) >= 0
            ? nextRow.accounts.findIndex((a) => a.isPrimary)
            : 0;
          nextRow.accounts[primaryIdx] = {
            ...nextRow.accounts[primaryIdx],
            ...(data.accessToken ? { accessToken: data.accessToken } : {}),
            ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}),
            ...(data.expiresAt ? { expiresAt: data.expiresAt } : {}),
          };
        }
      }

      await this._writeSupaPlatform(userId, ctx.socialLinks, ctx.oauth, platform, nextRow);
      logger.info(`OAuth tokens saved for ${platform}`, { userId, provider, accounts: nextRow.accounts?.length || 0 });
      return;
    }

    // Mongoose path — same logic, different storage.
    const ctx = await this._readMongoPlatform(userId, platform);
    if (!ctx) throw new Error('User not found in Mongoose');
    const normalised = this._normalisePlatformRow(ctx.platformRow) || { accounts: [] };
    const hasIdentity = !!(data.platformUserId || data.platform_user_id || data.userInfo?.id);
    const hasTokens = !!(data.accessToken || data.refreshToken);
    const existingAccountsLen = Array.isArray(normalised.accounts) ? normalised.accounts.length : 0;
    const nextRow = hasIdentity
      ? this._upsertAccount(normalised, data)
      : { ...normalised, ...data, connected: hasTokens || existingAccountsLen > 0 || !!normalised.connected };
    ctx.user.oauth = ctx.user.oauth || {};
    ctx.user.oauth[ctx.schemaPlatform] = nextRow;
    if (typeof ctx.user.markModified === 'function') ctx.user.markModified('oauth');
    await ctx.user.save();
    logger.info(`OAuth tokens saved for ${platform}`, { userId, provider, accounts: nextRow.accounts?.length || 0 });
  }

  /**
   * Read the platform row. Always returns a normalised shape with
   * `accounts[]` populated, or null if nothing's connected.
   */
  static async loadTokens(userId, platform) {
    const provider = this.getProvider();
    if (provider === 'supabase') {
      const ctx = await this._readSupaPlatform(userId, platform);
      if (!ctx) return null;
      return this._normalisePlatformRow(ctx.platformRow);
    }
    const ctx = await this._readMongoPlatform(userId, platform);
    if (!ctx) return null;
    return this._normalisePlatformRow(ctx.platformRow);
  }

  /** List every connected account for a platform. */
  static async listAccounts(userId, platform) {
    const row = await this.loadTokens(userId, platform);
    return Array.isArray(row?.accounts) ? row.accounts : [];
  }

  /**
   * Fetch one specific account. If `accountId` is null/undefined, returns
   * the active account (`activeAccountId`) or the primary one.
   */
  static async getAccount(userId, platform, accountId = null) {
    const row = await this.loadTokens(userId, platform);
    if (!row || !Array.isArray(row.accounts) || row.accounts.length === 0) return null;
    if (accountId) {
      return row.accounts.find((a) => a.accountId === accountId || a.platformUserId === accountId) || null;
    }
    if (row.activeAccountId) {
      const active = row.accounts.find((a) => a.accountId === row.activeAccountId);
      if (active) return active;
    }
    return row.accounts.find((a) => a.isPrimary) || row.accounts[0];
  }

  /**
   * Append a new account. Convenience wrapper around saveTokens that
   * ensures the account is added rather than overwriting state-only.
   */
  static async addAccount(userId, platform, accountData) {
    if (!accountData || (!accountData.platformUserId && !accountData.platform_user_id && !accountData.id)) {
      throw new Error('addAccount requires platformUserId to identify the account');
    }
    return this.saveTokens(userId, platform, accountData);
  }

  /**
   * Remove one account by id. If no `accountId` is given, clears the
   * whole platform (matches the old clearTokens contract). Returns the
   * remaining account count.
   */
  static async removeAccount(userId, platform, accountId = null) {
    const provider = this.getProvider();

    if (!accountId) {
      await this.clearTokens(userId, platform);
      return 0;
    }

    if (provider === 'supabase') {
      const ctx = await this._readSupaPlatform(userId, platform);
      if (!ctx) return 0;
      const normalised = this._normalisePlatformRow(ctx.platformRow);
      if (!normalised) return 0;
      const remaining = (normalised.accounts || []).filter(
        (a) => a.accountId !== accountId && a.platformUserId !== accountId
      );
      if (remaining.length === 0) {
        // Last account → clear the whole row to keep the shape clean.
        await this.clearTokens(userId, platform);
        return 0;
      }
      // Promote first survivor to primary if we deleted the old primary.
      if (!remaining.some((a) => a.isPrimary)) remaining[0].isPrimary = true;
      const primary = remaining.find((a) => a.isPrimary) || remaining[0];
      const nextRow = {
        ...normalised,
        accounts: remaining,
        activeAccountId: primary.accountId,
        accessToken: primary.accessToken || null,
        refreshToken: primary.refreshToken || null,
        platformUserId: primary.platformUserId,
        platformUsername: primary.platformUsername || null,
      };
      await this._writeSupaPlatform(userId, ctx.socialLinks, ctx.oauth, platform, nextRow);
      return remaining.length;
    }

    const ctx = await this._readMongoPlatform(userId, platform);
    if (!ctx) return 0;
    const normalised = this._normalisePlatformRow(ctx.platformRow);
    if (!normalised) return 0;
    const remaining = (normalised.accounts || []).filter(
      (a) => a.accountId !== accountId && a.platformUserId !== accountId
    );
    if (remaining.length === 0) {
      await this.clearTokens(userId, platform);
      return 0;
    }
    if (!remaining.some((a) => a.isPrimary)) remaining[0].isPrimary = true;
    const primary = remaining.find((a) => a.isPrimary) || remaining[0];
    ctx.user.oauth[ctx.schemaPlatform] = {
      ...normalised,
      accounts: remaining,
      activeAccountId: primary.accountId,
      accessToken: primary.accessToken || null,
      refreshToken: primary.refreshToken || null,
      platformUserId: primary.platformUserId,
      platformUsername: primary.platformUsername || null,
    };
    if (typeof ctx.user.markModified === 'function') ctx.user.markModified('oauth');
    await ctx.user.save();
    return remaining.length;
  }

  /** Switch which account is "active" for one-account UI surfaces. */
  static async setActiveAccount(userId, platform, accountId) {
    const provider = this.getProvider();
    if (provider === 'supabase') {
      const ctx = await this._readSupaPlatform(userId, platform);
      if (!ctx) return false;
      const row = this._normalisePlatformRow(ctx.platformRow);
      if (!row || !row.accounts?.some((a) => a.accountId === accountId)) return false;
      const target = row.accounts.find((a) => a.accountId === accountId);
      const nextRow = {
        ...row,
        activeAccountId: accountId,
        accessToken: target.accessToken,
        refreshToken: target.refreshToken,
        platformUserId: target.platformUserId,
        platformUsername: target.platformUsername || null,
      };
      await this._writeSupaPlatform(userId, ctx.socialLinks, ctx.oauth, platform, nextRow);
      return true;
    }
    const ctx = await this._readMongoPlatform(userId, platform);
    if (!ctx) return false;
    const row = this._normalisePlatformRow(ctx.platformRow);
    if (!row || !row.accounts?.some((a) => a.accountId === accountId)) return false;
    const target = row.accounts.find((a) => a.accountId === accountId);
    ctx.user.oauth[ctx.schemaPlatform] = {
      ...row,
      activeAccountId: accountId,
      accessToken: target.accessToken,
      refreshToken: target.refreshToken,
      platformUserId: target.platformUserId,
      platformUsername: target.platformUsername || null,
    };
    if (typeof ctx.user.markModified === 'function') ctx.user.markModified('oauth');
    await ctx.user.save();
    return true;
  }

  /**
   * Stash an in-flight OAuth `state` namespaced by the state value itself
   * — never overwrites another in-flight flow's state. Cleaned up on
   * consume by the callback.
   */
  static async putState(userId, platform, state, meta = {}) {
    const row = (await this.loadTokens(userId, platform)) || { accounts: [] };
    const states = { ...(row.states || {}), [state]: { ...meta, createdAt: new Date().toISOString() } };
    // Best-effort GC: drop states older than 30 minutes.
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const k of Object.keys(states)) {
      const t = Date.parse(states[k]?.createdAt || '');
      if (Number.isFinite(t) && t < cutoff) delete states[k];
    }
    return this.saveTokens(userId, platform, { states });
  }

  /** True if the given state exists for the user+platform; consume it on read. */
  static async consumeState(userId, platform, state) {
    const row = await this.loadTokens(userId, platform);
    const states = row?.states || {};
    if (!states[state]) return false;
    const remaining = { ...states };
    delete remaining[state];
    await this.saveTokens(userId, platform, { states: remaining });
    return true;
  }

  /** Disconnect — clears every account for the platform. */
  static async clearTokens(userId, platform) {
    const provider = this.getProvider();

    if (provider === 'supabase') {
      const ctx = await this._readSupaPlatform(userId, platform);
      if (!ctx) return;
      const oauth = { ...ctx.oauth };
      delete oauth[platform];
      await this._supa()
        .from('users')
        .update({ social_links: { ...ctx.socialLinks, oauth } })
        .eq('id', userId);
    } else {
      const User = require('../models/User');
      const user = await User.findById(userId);
      if (!user) return;
      const schemaPlatform = platform === 'google' ? 'youtube' : platform;
      if (user.oauth && user.oauth[schemaPlatform]) {
        user.oauth[schemaPlatform] = { connected: false, accounts: [] };
        if (typeof user.markModified === 'function') user.markModified('oauth');
        await user.save();
      }
    }

    logger.info(`OAuth tokens cleared for ${platform}`, { userId, provider });
  }
}

module.exports = OAuthStorage;
