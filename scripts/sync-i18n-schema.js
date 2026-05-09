#!/usr/bin/env node
/**
 * Sync stale locale catalogs to the new en.json schema.
 *
 * Used after the dashboard / settings / video / calendar / teams sections
 * were restructured (e.g. dashboard.welcome went from a string to an object
 * keyed by time-of-day). Preserves existing translations, maps a handful of
 * old keys to their new homes (so we don't lose translation work), and
 * fills the brand-new keys from the per-locale translations table below.
 *
 * Run:  node scripts/sync-i18n-schema.js
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'client', 'public', 'i18n', 'locales');
const EN = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8'));

// ── Old-key → new-key migration map ──────────────────────────────────────
// Keys that were renamed/restructured. Values from the old key are reused
// at the new path so we don't have to retranslate them from scratch.
const RENAMES = {
  // Old settings.* flat keys → new sections.*.title / appearance.* / localization.*
  'settings.profile':       'settings.sections.general.title', // not perfect; placeholder
  'settings.theme':         'settings.appearance.theme',
  'settings.themeLight':    'settings.appearance.light',
  'settings.themeDark':     'settings.appearance.dark',
  'settings.themeAuto':     'settings.appearance.system',
  'settings.language':      'settings.localization.language',
  'settings.timezone':      'settings.localization.timezone',
  'settings.saveSettings':  'settings.save',
  'settings.saveFailed':    'settings.saveError',
};

// ── Per-locale translations for keys that did not exist before ────────────
// Only contains the brand-new keys (dashboard.{welcome.*, actions.*, stats.*},
// settings.{subtitle, sections.*, appearance.*, localization.title, brandKit.*,
// aiConfig.*, danger.*, save/saving/saved}, video.{subtitle, loadError,
// stats.*, projects.*, filters.*, card.*, editTitle, preview, modes.*,
// backToModes, analyze, diagnostics, configRules*, tasks, format, captionStyle,
// start, processingDesc, complete*}, calendar.*, teams.*).
const NEW_TRANSLATIONS = {
  fr: {
    dashboard: {
      welcome: { morning: 'Bonjour', afternoon: 'Bon après-midi', evening: 'Bonsoir', badge: 'Plateforme Click' },
      actions: { title: 'Actions rapides', launch: 'Lancer le workflow', forgeDesc: 'Transforme instantanément vos rushes en formats viraux courts.' },
      stats: { title: 'Vue d\'ensemble', subtitle: 'Insights IA pour vos comptes connectés.', viewDetailed: 'Voir les détails' },
    },
    settings: {
      subtitle: 'Gérez votre compte, vos préférences et vos intégrations.',
      sections: {
        general: { title: 'Général', subtitle: 'Préférences de plateforme et localisation' },
        notifications: { title: 'Notifications', subtitle: 'Configurez vos alertes' },
        privacy: { title: 'Confidentialité', subtitle: 'Gérez vos données et consentements' },
        security: { title: 'Sécurité', subtitle: 'Protégez votre compte et vos identifiants' },
        brand: { title: 'Kit de marque', subtitle: 'Maintenez la cohérence visuelle de vos vidéos' },
        ai: { title: 'Configuration IA', subtitle: 'Optimisez les workflows autonomes' },
      },
      appearance: { title: 'Apparence' },
      localization: { title: 'Localisation' },
      brandKit: {
        colors: 'Couleurs de marque', primary: 'Couleur primaire', accent: 'Couleur d\'accent',
        typography: 'Typographie', headings: 'Police des titres', body: 'Police du corps',
        overlays: 'Superpositions et filigranes', logo: 'Logo de marque', opacity: 'Opacité du logo',
        position: 'Position du logo', save: 'Enregistrer le kit de marque',
      },
      aiConfig: {
        autonomous: 'Édition autonome',
        autonomousDesc: 'Permet à l\'IA d\'affiner les montages selon les tendances de niche',
        threshold: 'Seuil de confiance',
        thresholdDesc: 'Confiance IA minimale requise pour la publication automatique',
        rendering: 'Moteur de rendu',
        renderingDesc: 'Moteur préféré pour les exports haute fidélité',
      },
      danger: {
        title: 'Zone dangereuse', deleteAccount: 'Supprimer le compte',
        deleteDesc: 'Supprime définitivement votre compte et toutes les données associées. Cette action est irréversible.',
        confirmDelete: 'Confirmer la suppression',
      },
      saving: 'Enregistrement...', saved: 'Paramètres mis à jour', saveError: 'Échec de la mise à jour',
    },
    video: {
      subtitle: 'Centre de commande pour votre intelligence de contenu',
      loadError: 'Échec du chargement des données vidéo.',
      stats: { title: 'Télémétrie', total: 'Séquences totales', processed: 'Synthétisées', storage: 'Stockage', performance: 'Rétention nette' },
      projects: { title: 'Bibliothèque de séquences', empty: 'Aucune séquence trouvée.', create: 'Nouvelle séquence', recent: 'Accès récents' },
      filters: { all: 'Tous les projets', completed: 'Terminés', processing: 'En cours', pending: 'En attente', failed: 'Échoués' },
      card: { open: 'Ouvrir l\'éditeur', clipsCount: '{count} clips' },
      editTitle: 'Modifier la vidéo', preview: 'Aperçu',
      modes: {
        ai: 'Édition IA auto', aiDesc: 'L\'IA trouve les hooks, supprime les silences et génère des clips.',
        manual: 'Éditeur manuel avancé', manualDesc: 'Accédez à la timeline complète pour des coupes précises et du mixage.',
      },
      backToModes: 'Choix du workflow', analyze: 'Analyser la vidéo', diagnostics: 'Diagnostics',
      configRules: 'Règles de traitement', configRulesDesc: 'Configurez le montage IA.',
      tasks: 'Tâches IA', format: 'Format de sortie', captionStyle: 'Style des sous-titres',
      start: 'Lancer l\'édition IA', processingDesc: 'L\'IA analyse, coupe et optimise votre vidéo...',
      complete: 'Traitement terminé', completeDesc: 'Votre vidéo a été traitée et montée par l\'IA.',
    },
    calendar: {
      title: 'Calendrier de contenu',
      subtitle: 'Gérez et passez en revue votre planning multi-plateformes.',
      addPost: 'Planifier une publication', rescheduled: 'Publication reprogrammée', editInScheduler: 'Éditer dans le planificateur',
    },
    teams: {
      title: 'Équipes', subtitle: 'Collaborez avec éditeurs, relecteurs et contributeurs.',
      search: 'Rechercher des équipes...', create: 'Nouvelle équipe', createFirst: 'Créez votre première équipe',
      noTeams: 'Aucune équipe', created: 'Équipe créée',
      members: 'Membres', proFeature: 'Collaboration Pro', proDesc: 'Permissions avancées et bibliothèques d\'assets partagées.',
      createSubtitle: 'Invitez des membres après la création.',
      name: 'Nom de l\'équipe', description: 'Description', noDescription: 'Aucune description.',
    },
  },

  de: {
    dashboard: {
      welcome: { morning: 'Guten Morgen', afternoon: 'Guten Tag', evening: 'Guten Abend', badge: 'Click-Plattform' },
      actions: { title: 'Schnellaktionen', launch: 'Workflow starten', forgeDesc: 'Verwandelt Rohmaterial sofort in virale Kurzformate.' },
      stats: { title: 'Performance-Übersicht', subtitle: 'KI-Insights für deine verbundenen Konten.', viewDetailed: 'Details anzeigen' },
    },
    settings: {
      subtitle: 'Verwalte dein Konto, deine Einstellungen und Integrationen.',
      sections: {
        general: { title: 'Allgemein', subtitle: 'Plattform-Einstellungen und Lokalisierung' },
        notifications: { title: 'Benachrichtigungen', subtitle: 'Konfiguriere, wie du Hinweise erhältst' },
        privacy: { title: 'Datenschutz', subtitle: 'Verwalte deine Daten und Einwilligungen' },
        security: { title: 'Sicherheit', subtitle: 'Schütze Konto und Zugangsdaten' },
        brand: { title: 'Marken-Kit', subtitle: 'Visuelle Konsistenz über alle Videos' },
        ai: { title: 'KI-Konfiguration', subtitle: 'Autonome Workflows optimieren' },
      },
      appearance: { title: 'Erscheinungsbild' },
      localization: { title: 'Lokalisierung' },
      brandKit: {
        colors: 'Markenfarben', primary: 'Primärfarbe', accent: 'Akzentfarbe',
        typography: 'Typografie', headings: 'Überschrift-Schrift', body: 'Fließtext-Schrift',
        overlays: 'Overlays & Wasserzeichen', logo: 'Marken-Logo', opacity: 'Logo-Deckkraft',
        position: 'Logo-Position', save: 'Marken-Kit speichern',
      },
      aiConfig: {
        autonomous: 'Autonome Bearbeitung',
        autonomousDesc: 'KI darf Edits anhand von Nischen-Trends verfeinern',
        threshold: 'Konfidenz-Schwelle',
        thresholdDesc: 'Mindest-Konfidenz der KI für automatisches Veröffentlichen',
        rendering: 'Render-Engine',
        renderingDesc: 'Bevorzugte Engine für hochwertige Exporte',
      },
      danger: {
        title: 'Gefahrenzone', deleteAccount: 'Konto löschen',
        deleteDesc: 'Entfernt Konto und alle Daten dauerhaft. Nicht rückgängig zu machen.',
        confirmDelete: 'Löschen bestätigen',
      },
      saving: 'Speichern...', saved: 'Einstellungen aktualisiert', saveError: 'Aktualisierung fehlgeschlagen',
    },
    video: {
      subtitle: 'Kommandozentrale für deine Content-Intelligence',
      loadError: 'Laden der Videodaten fehlgeschlagen.',
      stats: { title: 'Telemetrie', total: 'Sequenzen gesamt', processed: 'Synthetisiert', storage: 'Speicher', performance: 'Netto-Retention' },
      projects: { title: 'Sequenz-Bibliothek', empty: 'Keine Sequenzen gefunden.', create: 'Neue Sequenz', recent: 'Zuletzt geöffnet' },
      filters: { all: 'Alle Projekte', completed: 'Abgeschlossen', processing: 'In Bearbeitung', pending: 'Ausstehend', failed: 'Fehlgeschlagen' },
      card: { open: 'Editor öffnen', clipsCount: '{count} Clips' },
      editTitle: 'Video bearbeiten', preview: 'Vorschau',
      modes: {
        ai: 'KI-Auto-Edit', aiDesc: 'KI findet Hooks, entfernt Pausen und erzeugt Clips.',
        manual: 'Erweiterter manueller Editor', manualDesc: 'Vollständige Timeline für präzise Schnitte und Mixing.',
      },
      backToModes: 'Workflow-Auswahl', analyze: 'Video analysieren', diagnostics: 'Diagnose',
      configRules: 'Verarbeitungsregeln', configRulesDesc: 'Konfiguriere, wie die KI dein Video bearbeitet.',
      tasks: 'KI-Aufgaben', format: 'Ausgabeformat', captionStyle: 'Untertitel-Stil',
      start: 'KI-Bearbeitung starten', processingDesc: 'Die KI analysiert, schneidet und optimiert dein Video...',
      complete: 'Verarbeitung abgeschlossen', completeDesc: 'Dein Video wurde von der KI bearbeitet.',
    },
    calendar: {
      title: 'Content-Kalender', subtitle: 'Verwalte deinen plattformübergreifenden Plan.',
      addPost: 'Beitrag planen', rescheduled: 'Beitrag neu geplant', editInScheduler: 'Im Planer bearbeiten',
    },
    teams: {
      title: 'Teams', subtitle: 'Arbeite mit Editoren, Reviewern und Mitwirkenden.',
      search: 'Teams suchen...', create: 'Neues Team', createFirst: 'Erstes Team erstellen',
      noTeams: 'Keine Teams', created: 'Team erstellt',
      members: 'Mitglieder', proFeature: 'Pro-Kollaboration', proDesc: 'Erweiterte Berechtigungen und geteilte Asset-Bibliotheken.',
      createSubtitle: 'Mitglieder nach Erstellung einladen.',
      name: 'Team-Name', description: 'Beschreibung', noDescription: 'Keine Beschreibung.',
    },
  },

  it: {
    dashboard: {
      welcome: { morning: 'Buongiorno', afternoon: 'Buon pomeriggio', evening: 'Buonasera', badge: 'Piattaforma Click' },
      actions: { title: 'Azioni rapide', launch: 'Avvia workflow', forgeDesc: 'Trasforma istantaneamente il materiale grezzo in pacchetti virali short-form.' },
      stats: { title: 'Panoramica performance', subtitle: 'Insight IA per i tuoi account collegati.', viewDetailed: 'Vedi dettagli' },
    },
    settings: {
      subtitle: 'Gestisci account, preferenze e integrazioni.',
      sections: {
        general: { title: 'Generale', subtitle: 'Preferenze piattaforma e localizzazione' },
        notifications: { title: 'Notifiche', subtitle: 'Configura come ricevi gli avvisi' },
        privacy: { title: 'Privacy', subtitle: 'Gestisci dati e consensi' },
        security: { title: 'Sicurezza', subtitle: 'Proteggi account e credenziali' },
        brand: { title: 'Brand Kit', subtitle: 'Mantieni coerenza visiva nei video' },
        ai: { title: 'Configurazione IA', subtitle: 'Ottimizza workflow autonomi' },
      },
      appearance: { title: 'Aspetto' },
      localization: { title: 'Localizzazione' },
      brandKit: {
        colors: 'Colori del brand', primary: 'Colore primario', accent: 'Colore accent',
        typography: 'Tipografia', headings: 'Font titoli', body: 'Font corpo',
        overlays: 'Overlay e watermark', logo: 'Logo brand', opacity: 'Opacità logo',
        position: 'Posizione logo', save: 'Salva Brand Kit',
      },
      aiConfig: {
        autonomous: 'Editing autonomo',
        autonomousDesc: 'Permetti all\'IA di affinare gli edit in base ai trend di nicchia',
        threshold: 'Soglia di confidenza',
        thresholdDesc: 'Confidenza IA minima per pubblicazione automatica',
        rendering: 'Motore di rendering',
        renderingDesc: 'Motore preferito per export ad alta fedeltà',
      },
      danger: {
        title: 'Zona pericolosa', deleteAccount: 'Elimina account',
        deleteDesc: 'Rimuove permanentemente account e dati. Azione irreversibile.',
        confirmDelete: 'Conferma eliminazione',
      },
      saving: 'Salvataggio...', saved: 'Impostazioni aggiornate', saveError: 'Aggiornamento fallito',
    },
    video: {
      subtitle: 'Centro di comando per la tua content intelligence',
      loadError: 'Errore nel caricamento dati video.',
      stats: { title: 'Telemetria', total: 'Sequenze totali', processed: 'Sintetizzate', storage: 'Storage', performance: 'Retention netta' },
      projects: { title: 'Libreria sequenze', empty: 'Nessuna sequenza trovata.', create: 'Nuova sequenza', recent: 'Accessi recenti' },
      filters: { all: 'Tutti i progetti', completed: 'Completati', processing: 'In elaborazione', pending: 'In attesa', failed: 'Falliti' },
      card: { open: 'Apri editor', clipsCount: '{count} clip' },
      editTitle: 'Modifica video', preview: 'Anteprima',
      modes: {
        ai: 'Edit IA automatico', aiDesc: 'L\'IA trova hook, rimuove silenzi e genera clip.',
        manual: 'Editor manuale avanzato', manualDesc: 'Timeline completa per tagli e mixing precisi.',
      },
      backToModes: 'Scelta workflow', analyze: 'Analizza video', diagnostics: 'Diagnostica',
      configRules: 'Regole di elaborazione', configRulesDesc: 'Configura come l\'IA modifica il video.',
      tasks: 'Task IA', format: 'Formato output', captionStyle: 'Stile sottotitoli',
      start: 'Avvia editing IA', processingDesc: 'L\'IA sta analizzando, tagliando e ottimizzando il video...',
      complete: 'Elaborazione completata', completeDesc: 'Video elaborato e montato dall\'IA.',
    },
    calendar: {
      title: 'Calendario contenuti', subtitle: 'Gestisci e rivedi il tuo piano multi-piattaforma.',
      addPost: 'Pianifica post', rescheduled: 'Post riprogrammato', editInScheduler: 'Modifica nel planner',
    },
    teams: {
      title: 'Team', subtitle: 'Collabora con editor, revisori e contributor.',
      search: 'Cerca team...', create: 'Nuovo team', createFirst: 'Crea il primo team',
      noTeams: 'Nessun team', created: 'Team creato',
      members: 'Membri', proFeature: 'Collaborazione Pro', proDesc: 'Permessi avanzati e librerie di asset condivise.',
      createSubtitle: 'Invita i membri dopo la creazione.',
      name: 'Nome del team', description: 'Descrizione', noDescription: 'Nessuna descrizione.',
    },
  },

  pt: {
    dashboard: {
      welcome: { morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite', badge: 'Plataforma Click' },
      actions: { title: 'Ações rápidas', launch: 'Iniciar fluxo', forgeDesc: 'Transforma material bruto em pacotes virais curtos instantaneamente.' },
      stats: { title: 'Visão geral de performance', subtitle: 'Insights de IA para suas contas conectadas.', viewDetailed: 'Ver detalhes' },
    },
    settings: {
      subtitle: 'Gerencie sua conta, preferências e integrações.',
      sections: {
        general: { title: 'Geral', subtitle: 'Preferências da plataforma e localização' },
        notifications: { title: 'Notificações', subtitle: 'Configure como recebe alertas' },
        privacy: { title: 'Privacidade', subtitle: 'Gerencie dados e consentimentos' },
        security: { title: 'Segurança', subtitle: 'Proteja sua conta e credenciais' },
        brand: { title: 'Brand Kit', subtitle: 'Mantenha consistência visual nos vídeos' },
        ai: { title: 'Configuração de IA', subtitle: 'Otimize fluxos autônomos' },
      },
      appearance: { title: 'Aparência' },
      localization: { title: 'Localização' },
      brandKit: {
        colors: 'Cores da marca', primary: 'Cor primária', accent: 'Cor de destaque',
        typography: 'Tipografia', headings: 'Fonte de títulos', body: 'Fonte de corpo',
        overlays: 'Sobreposições e marcas d\'água', logo: 'Logo da marca', opacity: 'Opacidade do logo',
        position: 'Posição do logo', save: 'Salvar Brand Kit',
      },
      aiConfig: {
        autonomous: 'Edição autônoma',
        autonomousDesc: 'Permita à IA refinar edições com base em tendências do nicho',
        threshold: 'Limite de confiança',
        thresholdDesc: 'Confiança mínima da IA para publicação automática',
        rendering: 'Motor de renderização',
        renderingDesc: 'Motor preferido para exportações de alta fidelidade',
      },
      danger: {
        title: 'Zona de perigo', deleteAccount: 'Excluir conta',
        deleteDesc: 'Remove permanentemente sua conta e todos os dados. Ação irreversível.',
        confirmDelete: 'Confirmar exclusão',
      },
      saving: 'Salvando...', saved: 'Configurações atualizadas', saveError: 'Falha ao atualizar',
    },
    video: {
      subtitle: 'Centro de comando da sua inteligência de conteúdo',
      loadError: 'Falha ao carregar dados do vídeo.',
      stats: { title: 'Telemetria', total: 'Sequências totais', processed: 'Sintetizadas', storage: 'Armazenamento', performance: 'Retenção líquida' },
      projects: { title: 'Biblioteca de sequências', empty: 'Nenhuma sequência encontrada.', create: 'Nova sequência', recent: 'Acessos recentes' },
      filters: { all: 'Todos os projetos', completed: 'Concluídos', processing: 'Processando', pending: 'Pendentes', failed: 'Falharam' },
      card: { open: 'Abrir editor', clipsCount: '{count} clipes' },
      editTitle: 'Editar vídeo', preview: 'Pré-visualização',
      modes: {
        ai: 'Edição IA automática', aiDesc: 'A IA encontra hooks, remove silêncios e gera clipes.',
        manual: 'Editor manual avançado', manualDesc: 'Timeline completa para cortes e mixagem precisos.',
      },
      backToModes: 'Seleção de fluxo', analyze: 'Analisar vídeo', diagnostics: 'Diagnóstico',
      configRules: 'Regras de processamento', configRulesDesc: 'Configure como a IA edita seu vídeo.',
      tasks: 'Tarefas da IA', format: 'Formato de saída', captionStyle: 'Estilo de legendas',
      start: 'Iniciar edição IA', processingDesc: 'A IA está analisando, cortando e otimizando seu vídeo...',
      complete: 'Processamento concluído', completeDesc: 'Seu vídeo foi processado e editado pela IA.',
    },
    calendar: {
      title: 'Calendário de conteúdo', subtitle: 'Gerencie e revise seu cronograma multi-plataforma.',
      addPost: 'Agendar post', rescheduled: 'Post reagendado', editInScheduler: 'Editar no agendador',
    },
    teams: {
      title: 'Equipes', subtitle: 'Colabore com editores, revisores e contribuidores.',
      search: 'Buscar equipes...', create: 'Nova equipe', createFirst: 'Crie sua primeira equipe',
      noTeams: 'Nenhuma equipe', created: 'Equipe criada',
      members: 'Membros', proFeature: 'Colaboração Pro', proDesc: 'Permissões avançadas e bibliotecas compartilhadas.',
      createSubtitle: 'Convide membros após criar.',
      name: 'Nome da equipe', description: 'Descrição', noDescription: 'Sem descrição.',
    },
  },

  ja: {
    dashboard: {
      welcome: { morning: 'おはようございます', afternoon: 'こんにちは', evening: 'こんばんは', badge: 'Click プラットフォーム' },
      actions: { title: 'クイックアクション', launch: 'ワークフロー開始', forgeDesc: '素材を瞬時にバイラルなショート動画パックへ変換。' },
      stats: { title: 'パフォーマンス概要', subtitle: '連携アカウント向けのAIインサイト。', viewDetailed: '詳細を見る' },
    },
    settings: {
      subtitle: 'アカウント・設定・連携を管理します。',
      sections: {
        general: { title: '一般', subtitle: 'プラットフォーム設定とローカライズ' },
        notifications: { title: '通知', subtitle: '通知の受け取り方を設定' },
        privacy: { title: 'プライバシー', subtitle: 'データと同意を管理' },
        security: { title: 'セキュリティ', subtitle: 'アカウントと資格情報を保護' },
        brand: { title: 'ブランドキット', subtitle: '動画全体のビジュアル一貫性を維持' },
        ai: { title: 'AI 設定', subtitle: '自律ワークフローを最適化' },
      },
      appearance: { title: '外観' },
      localization: { title: 'ローカライズ' },
      brandKit: {
        colors: 'ブランドカラー', primary: 'プライマリカラー', accent: 'アクセントカラー',
        typography: 'タイポグラフィ', headings: '見出しフォント', body: '本文フォント',
        overlays: 'オーバーレイとウォーターマーク', logo: 'ブランドロゴ', opacity: 'ロゴの不透明度',
        position: 'ロゴの位置', save: 'ブランドキットを保存',
      },
      aiConfig: {
        autonomous: '自律編集',
        autonomousDesc: 'AIにニッチのトレンドに基づいた編集調整を許可',
        threshold: '信頼度しきい値',
        thresholdDesc: '自動公開に必要な最小AI信頼度',
        rendering: 'レンダリングエンジン',
        renderingDesc: '高精細エクスポートで使うエンジン',
      },
      danger: {
        title: '危険ゾーン', deleteAccount: 'アカウントを削除',
        deleteDesc: 'アカウントと関連データを完全に削除します。元には戻せません。',
        confirmDelete: '削除を確認',
      },
      saving: '保存中...', saved: '設定を更新しました', saveError: '更新に失敗しました',
    },
    video: {
      subtitle: 'コンテンツ・インテリジェンスの司令塔',
      loadError: '動画データの読み込みに失敗しました。',
      stats: { title: 'テレメトリ', total: '総シーケンス', processed: '合成済み', storage: 'ストレージ', performance: '純リテンション' },
      projects: { title: 'シーケンス・ライブラリ', empty: 'シーケンスがありません。', create: '新規シーケンス', recent: '最近のアクセス' },
      filters: { all: 'すべて', completed: '完了', processing: '処理中', pending: '保留中', failed: '失敗' },
      card: { open: 'エディタを開く', clipsCount: 'クリップ {count} 件' },
      editTitle: '動画を編集', preview: 'プレビュー',
      modes: {
        ai: 'AI 自動編集', aiDesc: 'AI がフックを抽出し、無音を削除し、クリップを生成します。',
        manual: '高度な手動エディタ', manualDesc: 'タイムラインで精密なカットとミキシング。',
      },
      backToModes: 'ワークフロー選択', analyze: '動画を解析', diagnostics: '診断',
      configRules: '処理ルール', configRulesDesc: 'AI の編集方法を設定します。',
      tasks: 'AI タスク', format: '出力フォーマット', captionStyle: '字幕スタイル',
      start: 'AI 編集を開始', processingDesc: 'AI が動画を解析・カット・最適化しています...',
      complete: '処理完了', completeDesc: 'AI による編集が完了しました。',
    },
    calendar: {
      title: 'コンテンツ・カレンダー', subtitle: 'プラットフォーム横断のスケジュールを管理。',
      addPost: '投稿を予約', rescheduled: '投稿を再スケジュールしました', editInScheduler: 'スケジューラで編集',
    },
    teams: {
      title: 'チーム', subtitle: 'エディター、レビュアー、貢献者と共同作業。',
      search: 'チームを検索...', create: '新規チーム', createFirst: '最初のチームを作成',
      noTeams: 'チームがありません', created: 'チームを作成しました',
      members: 'メンバー', proFeature: 'Pro コラボ', proDesc: '高度な権限と共有アセットライブラリ。',
      createSubtitle: '作成後にメンバーを招待。',
      name: 'チーム名', description: '説明', noDescription: '説明はありません。',
    },
  },

  ko: {
    dashboard: {
      welcome: { morning: '좋은 아침입니다', afternoon: '좋은 오후입니다', evening: '좋은 저녁입니다', badge: 'Click 플랫폼' },
      actions: { title: '빠른 작업', launch: '워크플로 시작', forgeDesc: '원본 영상을 즉시 바이럴 숏폼 패키지로 변환합니다.' },
      stats: { title: '성과 개요', subtitle: '연결된 계정에 대한 AI 인사이트.', viewDetailed: '상세 보기' },
    },
    settings: {
      subtitle: '계정·환경설정·연동을 관리합니다.',
      sections: {
        general: { title: '일반', subtitle: '플랫폼 환경설정 및 로컬라이즈' },
        notifications: { title: '알림', subtitle: '알림 수신 방식 설정' },
        privacy: { title: '개인정보', subtitle: '데이터와 동의 관리' },
        security: { title: '보안', subtitle: '계정과 자격증명 보호' },
        brand: { title: '브랜드 키트', subtitle: '영상 전반의 비주얼 일관성 유지' },
        ai: { title: 'AI 설정', subtitle: '자율 워크플로 최적화' },
      },
      appearance: { title: '디스플레이' },
      localization: { title: '로컬라이즈' },
      brandKit: {
        colors: '브랜드 컬러', primary: '주 색상', accent: '강조 색상',
        typography: '타이포그래피', headings: '제목 폰트', body: '본문 폰트',
        overlays: '오버레이 및 워터마크', logo: '브랜드 로고', opacity: '로고 불투명도',
        position: '로고 위치', save: '브랜드 키트 저장',
      },
      aiConfig: {
        autonomous: '자율 편집',
        autonomousDesc: 'AI가 니치 트렌드에 따라 편집을 자동 보정',
        threshold: '신뢰도 임계값',
        thresholdDesc: '자동 게시에 필요한 AI 최소 신뢰도',
        rendering: '렌더링 엔진',
        renderingDesc: '고품질 내보내기에 사용할 엔진',
      },
      danger: {
        title: '위험 구역', deleteAccount: '계정 삭제',
        deleteDesc: '계정과 관련 데이터를 영구 삭제합니다. 되돌릴 수 없습니다.',
        confirmDelete: '삭제 확인',
      },
      saving: '저장 중...', saved: '설정이 업데이트되었습니다', saveError: '업데이트 실패',
    },
    video: {
      subtitle: '콘텐츠 인텔리전스 컨트롤 센터',
      loadError: '비디오 데이터 로드 실패.',
      stats: { title: '텔레메트리', total: '총 시퀀스', processed: '합성됨', storage: '스토리지', performance: '순 리텐션' },
      projects: { title: '시퀀스 라이브러리', empty: '시퀀스가 없습니다.', create: '새 시퀀스', recent: '최근 접근' },
      filters: { all: '모든 프로젝트', completed: '완료됨', processing: '처리 중', pending: '대기', failed: '실패' },
      card: { open: '편집기 열기', clipsCount: '클립 {count}개' },
      editTitle: '비디오 편집', preview: '미리보기',
      modes: {
        ai: 'AI 자동 편집', aiDesc: 'AI가 훅을 찾고, 무음을 제거하고, 클립을 생성합니다.',
        manual: '고급 수동 편집기', manualDesc: '정밀 컷과 믹싱을 위한 풀 타임라인.',
      },
      backToModes: '워크플로 선택', analyze: '비디오 분석', diagnostics: '진단',
      configRules: '처리 규칙', configRulesDesc: 'AI 편집 방식 설정.',
      tasks: 'AI 작업', format: '출력 포맷', captionStyle: '자막 스타일',
      start: 'AI 편집 시작', processingDesc: 'AI가 비디오를 분석·편집·최적화 중입니다...',
      complete: '처리 완료', completeDesc: 'AI 편집이 완료되었습니다.',
    },
    calendar: {
      title: '콘텐츠 캘린더', subtitle: '크로스 플랫폼 일정을 관리하고 검토합니다.',
      addPost: '게시물 예약', rescheduled: '게시물 일정이 변경됨', editInScheduler: '스케줄러에서 편집',
    },
    teams: {
      title: '팀', subtitle: '편집자·리뷰어·기여자와 협업.',
      search: '팀 검색...', create: '새 팀', createFirst: '첫 번째 팀 만들기',
      noTeams: '팀이 없습니다', created: '팀 생성됨',
      members: '멤버', proFeature: 'Pro 협업', proDesc: '고급 권한과 공유 에셋 라이브러리.',
      createSubtitle: '생성 후 멤버를 초대하세요.',
      name: '팀 이름', description: '설명', noDescription: '설명이 없습니다.',
    },
  },

  'zh-Hans': {
    dashboard: {
      welcome: { morning: '早上好', afternoon: '下午好', evening: '晚上好', badge: 'Click 平台' },
      actions: { title: '快捷操作', launch: '启动工作流', forgeDesc: '即刻把素材转化为爆款短视频套件。' },
      stats: { title: '性能概览', subtitle: '为已连接账号提供 AI 驱动的洞察。', viewDetailed: '查看详情' },
    },
    settings: {
      subtitle: '管理账号、偏好与集成。',
      sections: {
        general: { title: '通用', subtitle: '平台偏好与本地化' },
        notifications: { title: '通知', subtitle: '配置接收提醒方式' },
        privacy: { title: '隐私', subtitle: '管理数据与同意项' },
        security: { title: '安全', subtitle: '保护账号与凭据' },
        brand: { title: '品牌套件', subtitle: '保持视频视觉一致性' },
        ai: { title: 'AI 配置', subtitle: '优化自主工作流' },
      },
      appearance: { title: '外观' },
      localization: { title: '本地化' },
      brandKit: {
        colors: '品牌色', primary: '主色', accent: '强调色',
        typography: '排版', headings: '标题字体', body: '正文字体',
        overlays: '叠加与水印', logo: '品牌标志', opacity: '标志不透明度',
        position: '标志位置', save: '保存品牌套件',
      },
      aiConfig: {
        autonomous: '自主编辑',
        autonomousDesc: '允许 AI 根据细分领域趋势自动微调编辑',
        threshold: '置信度阈值',
        thresholdDesc: '自动发布所需的最低 AI 置信度',
        rendering: '渲染引擎',
        renderingDesc: '高保真导出首选引擎',
      },
      danger: {
        title: '危险区域', deleteAccount: '删除账号',
        deleteDesc: '永久删除账号及所有相关数据,操作不可逆。',
        confirmDelete: '确认删除',
      },
      saving: '保存中...', saved: '设置已更新', saveError: '更新失败',
    },
    video: {
      subtitle: '内容智能的指挥中心',
      loadError: '加载视频数据失败。',
      stats: { title: '遥测', total: '序列总数', processed: '已合成', storage: '存储', performance: '净留存' },
      projects: { title: '序列库', empty: '没有序列。', create: '新建序列', recent: '最近访问' },
      filters: { all: '全部项目', completed: '已完成', processing: '处理中', pending: '待处理', failed: '失败' },
      card: { open: '打开编辑器', clipsCount: '{count} 个片段' },
      editTitle: '编辑视频', preview: '预览',
      modes: {
        ai: 'AI 自动剪辑', aiDesc: 'AI 自动寻找钩子、移除静音并生成片段。',
        manual: '高级手动编辑器', manualDesc: '完整时间线,精细剪切与混音。',
      },
      backToModes: '工作流选择', analyze: '分析视频', diagnostics: '诊断',
      configRules: '处理规则', configRulesDesc: '配置 AI 如何编辑视频。',
      tasks: 'AI 任务', format: '输出格式', captionStyle: '字幕样式',
      start: '开始 AI 编辑', processingDesc: 'AI 正在分析、剪切并优化你的视频...',
      complete: '处理完成', completeDesc: 'AI 已完成视频剪辑。',
    },
    calendar: {
      title: '内容日历', subtitle: '管理与回顾跨平台内容计划。',
      addPost: '排期发布', rescheduled: '已重新排期', editInScheduler: '在排期器中编辑',
    },
    teams: {
      title: '团队', subtitle: '与编辑、审阅者与贡献者协作。',
      search: '搜索团队...', create: '新建团队', createFirst: '创建第一个团队',
      noTeams: '没有团队', created: '团队已创建',
      members: '成员', proFeature: 'Pro 协作', proDesc: '高级权限与共享素材库。',
      createSubtitle: '创建后再邀请成员。',
      name: '团队名称', description: '描述', noDescription: '没有描述。',
    },
  },

  ar: {
    dashboard: {
      welcome: { morning: 'صباح الخير', afternoon: 'مساء الخير', evening: 'مساء الخير', badge: 'منصة Click' },
      actions: { title: 'إجراءات سريعة', launch: 'بدء سير العمل', forgeDesc: 'حوّل اللقطات الخام فورًا إلى حزم فيديو قصيرة فيروسية.' },
      stats: { title: 'نظرة عامة على الأداء', subtitle: 'رؤى مدفوعة بالذكاء الاصطناعي لحساباتك المتصلة.', viewDetailed: 'عرض التفاصيل' },
    },
    settings: {
      subtitle: 'إدارة الحساب والتفضيلات والتكاملات.',
      sections: {
        general: { title: 'عام', subtitle: 'تفضيلات المنصة والتعريب' },
        notifications: { title: 'الإشعارات', subtitle: 'كيفية تلقي التنبيهات' },
        privacy: { title: 'الخصوصية', subtitle: 'إدارة بياناتك وموافقاتك' },
        security: { title: 'الأمان', subtitle: 'حماية الحساب وبيانات الاعتماد' },
        brand: { title: 'هوية العلامة', subtitle: 'حافظ على الاتساق البصري عبر الفيديوهات' },
        ai: { title: 'إعدادات الذكاء الاصطناعي', subtitle: 'تحسين سير العمل المستقل' },
      },
      appearance: { title: 'المظهر' },
      localization: { title: 'التعريب' },
      brandKit: {
        colors: 'ألوان العلامة', primary: 'اللون الأساسي', accent: 'لون التمييز',
        typography: 'الطباعة', headings: 'خط العناوين', body: 'خط النص',
        overlays: 'الطبقات والعلامات المائية', logo: 'شعار العلامة', opacity: 'شفافية الشعار',
        position: 'موضع الشعار', save: 'حفظ هوية العلامة',
      },
      aiConfig: {
        autonomous: 'تحرير مستقل',
        autonomousDesc: 'السماح للذكاء الاصطناعي بتحسين المونتاج وفق اتجاهات المجال',
        threshold: 'حد الثقة',
        thresholdDesc: 'الحد الأدنى لثقة الذكاء الاصطناعي للنشر التلقائي',
        rendering: 'محرّك العرض',
        renderingDesc: 'المحرّك المفضل للتصدير عالي الدقة',
      },
      danger: {
        title: 'منطقة خطر', deleteAccount: 'حذف الحساب',
        deleteDesc: 'حذف نهائي للحساب وكل البيانات المرتبطة. لا يمكن التراجع.',
        confirmDelete: 'تأكيد الحذف',
      },
      saving: 'جارٍ الحفظ...', saved: 'تم تحديث الإعدادات', saveError: 'فشل التحديث',
    },
    video: {
      subtitle: 'مركز قيادة لذكاء المحتوى لديك',
      loadError: 'فشل تحميل بيانات الفيديو.',
      stats: { title: 'القياسات', total: 'إجمالي التسلسلات', processed: 'تم تركيبها', storage: 'التخزين', performance: 'صافي الاحتفاظ' },
      projects: { title: 'مكتبة التسلسلات', empty: 'لا توجد تسلسلات.', create: 'تسلسل جديد', recent: 'وصول حديث' },
      filters: { all: 'كل المشاريع', completed: 'مكتمل', processing: 'قيد المعالجة', pending: 'في الانتظار', failed: 'فشل' },
      card: { open: 'فتح المحرّر', clipsCount: '{count} مقطع' },
      editTitle: 'تعديل الفيديو', preview: 'معاينة',
      modes: {
        ai: 'تحرير AI تلقائي', aiDesc: 'يجد الذكاء الاصطناعي العناوين الجاذبة ويحذف الصمت ويولّد المقاطع.',
        manual: 'محرّر يدوي متقدم', manualDesc: 'الجدول الزمني الكامل لقصاصات دقيقة ومزج صوتي.',
      },
      backToModes: 'اختيار سير العمل', analyze: 'تحليل الفيديو', diagnostics: 'تشخيص',
      configRules: 'قواعد المعالجة', configRulesDesc: 'اضبط كيف يحرّر الذكاء الاصطناعي الفيديو.',
      tasks: 'مهام الذكاء', format: 'تنسيق الإخراج', captionStyle: 'نمط الترجمة',
      start: 'بدء التحرير الذكي', processingDesc: 'الذكاء الاصطناعي يحلّل ويقصّ ويُحسّن الفيديو...',
      complete: 'اكتملت المعالجة', completeDesc: 'تم تحرير الفيديو بواسطة الذكاء الاصطناعي.',
    },
    calendar: {
      title: 'تقويم المحتوى', subtitle: 'إدارة ومراجعة جدول النشر متعدد المنصات.',
      addPost: 'جدولة منشور', rescheduled: 'تمت إعادة جدولة المنشور', editInScheduler: 'تعديل في المجدول',
    },
    teams: {
      title: 'الفرق', subtitle: 'تعاون مع المحرّرين والمراجعين والمساهمين.',
      search: 'بحث عن فرق...', create: 'فريق جديد', createFirst: 'أنشئ فريقك الأول',
      noTeams: 'لا توجد فرق', created: 'تم إنشاء الفريق',
      members: 'الأعضاء', proFeature: 'تعاون Pro', proDesc: 'صلاحيات متقدمة ومكتبات أصول مشتركة.',
      createSubtitle: 'يمكنك دعوة الأعضاء بعد الإنشاء.',
      name: 'اسم الفريق', description: 'الوصف', noDescription: 'بدون وصف.',
    },
  },

  hi: {
    dashboard: {
      welcome: { morning: 'सुप्रभात', afternoon: 'नमस्कार', evening: 'शुभ संध्या', badge: 'Click प्लेटफ़ॉर्म' },
      actions: { title: 'त्वरित क्रियाएँ', launch: 'वर्कफ़्लो शुरू करें', forgeDesc: 'कच्चे फुटेज को तुरंत वायरल शॉर्ट-फ़ॉर्म पैक में बदलें।' },
      stats: { title: 'प्रदर्शन सिंहावलोकन', subtitle: 'जुड़े खातों के लिए AI-संचालित इनसाइट।', viewDetailed: 'विवरण देखें' },
    },
    settings: {
      subtitle: 'अपने खाते, प्राथमिकताएँ और इंटीग्रेशन प्रबंधित करें।',
      sections: {
        general: { title: 'सामान्य', subtitle: 'प्लेटफ़ॉर्म प्राथमिकताएँ और लोकलाइज़ेशन' },
        notifications: { title: 'सूचनाएँ', subtitle: 'अलर्ट प्राप्ति का तरीक़ा सेट करें' },
        privacy: { title: 'गोपनीयता', subtitle: 'डेटा और सहमति प्रबंधित करें' },
        security: { title: 'सुरक्षा', subtitle: 'खाता और क्रेडेंशियल सुरक्षित रखें' },
        brand: { title: 'ब्रांड किट', subtitle: 'सभी वीडियो में दृश्य निरंतरता बनाए रखें' },
        ai: { title: 'AI कॉन्फ़िगरेशन', subtitle: 'स्वचालित वर्कफ़्लो को अनुकूलित करें' },
      },
      appearance: { title: 'दिखावट' },
      localization: { title: 'लोकलाइज़ेशन' },
      brandKit: {
        colors: 'ब्रांड रंग', primary: 'प्राथमिक रंग', accent: 'एक्सेंट रंग',
        typography: 'टाइपोग्राफ़ी', headings: 'शीर्षक फ़ॉन्ट', body: 'बॉडी फ़ॉन्ट',
        overlays: 'ओवरले और वॉटरमार्क', logo: 'ब्रांड लोगो', opacity: 'लोगो अपारदर्शिता',
        position: 'लोगो स्थिति', save: 'ब्रांड किट सहेजें',
      },
      aiConfig: {
        autonomous: 'स्वायत्त संपादन',
        autonomousDesc: 'AI को निच ट्रेंड के अनुसार एडिट सुधारने दें',
        threshold: 'विश्वास सीमा',
        thresholdDesc: 'स्वतः प्रकाशन के लिए न्यूनतम AI विश्वास',
        rendering: 'रेंडरिंग इंजन',
        renderingDesc: 'उच्च-गुणवत्ता निर्यात के लिए पसंदीदा इंजन',
      },
      danger: {
        title: 'खतरा क्षेत्र', deleteAccount: 'खाता हटाएँ',
        deleteDesc: 'खाता और सारा डेटा स्थायी रूप से हट जाएगा। यह वापस नहीं किया जा सकता।',
        confirmDelete: 'हटाने की पुष्टि करें',
      },
      saving: 'सहेज रहे हैं...', saved: 'सेटिंग्स अपडेट हुईं', saveError: 'अपडेट विफल',
    },
    video: {
      subtitle: 'आपकी कंटेंट इंटेलिजेंस के लिए कमांड सेंटर',
      loadError: 'वीडियो डेटा लोड करने में विफल।',
      stats: { title: 'टेलीमेट्री', total: 'कुल अनुक्रम', processed: 'संश्लेषित', storage: 'स्टोरेज', performance: 'नेट रिटेंशन' },
      projects: { title: 'अनुक्रम लाइब्रेरी', empty: 'कोई अनुक्रम नहीं।', create: 'नया अनुक्रम', recent: 'हाल की पहुँच' },
      filters: { all: 'सभी प्रोजेक्ट', completed: 'पूर्ण', processing: 'प्रोसेस हो रहा', pending: 'लंबित', failed: 'विफल' },
      card: { open: 'एडिटर खोलें', clipsCount: '{count} क्लिप' },
      editTitle: 'वीडियो संपादित करें', preview: 'पूर्वावलोकन',
      modes: {
        ai: 'AI ऑटो एडिट', aiDesc: 'AI हुक ढूँढता है, मौन हटाता है, और क्लिप बनाता है।',
        manual: 'उन्नत मैनुअल एडिटर', manualDesc: 'सटीक कट और मिक्सिंग के लिए पूर्ण टाइमलाइन।',
      },
      backToModes: 'वर्कफ़्लो चयन', analyze: 'वीडियो विश्लेषण', diagnostics: 'डायग्नॉस्टिक्स',
      configRules: 'प्रोसेसिंग नियम', configRulesDesc: 'सेट करें कि AI कैसे संपादित करेगा।',
      tasks: 'AI कार्य', format: 'आउटपुट प्रारूप', captionStyle: 'कैप्शन शैली',
      start: 'AI संपादन शुरू करें', processingDesc: 'AI विश्लेषण, कटिंग और ऑप्टिमाइज़ कर रहा है...',
      complete: 'प्रसंस्करण पूर्ण', completeDesc: 'AI ने वीडियो संपादित कर दिया।',
    },
    calendar: {
      title: 'कंटेंट कैलेंडर', subtitle: 'क्रॉस-प्लेटफ़ॉर्म शेड्यूल प्रबंधित और समीक्षा करें।',
      addPost: 'पोस्ट शेड्यूल करें', rescheduled: 'पोस्ट पुनर्निर्धारित', editInScheduler: 'शेड्यूलर में संपादित करें',
    },
    teams: {
      title: 'टीमें', subtitle: 'संपादकों, समीक्षकों और योगदानकर्ताओं के साथ सहयोग।',
      search: 'टीमें खोजें...', create: 'नई टीम', createFirst: 'पहली टीम बनाएँ',
      noTeams: 'कोई टीम नहीं', created: 'टीम बन गई',
      members: 'सदस्य', proFeature: 'Pro सहयोग', proDesc: 'उन्नत अनुमतियाँ और साझा एसेट लाइब्रेरी।',
      createSubtitle: 'बनाने के बाद सदस्यों को आमंत्रित करें।',
      name: 'टीम का नाम', description: 'विवरण', noDescription: 'कोई विवरण नहीं।',
    },
  },

  ru: {
    dashboard: {
      welcome: { morning: 'Доброе утро', afternoon: 'Добрый день', evening: 'Добрый вечер', badge: 'Платформа Click' },
      actions: { title: 'Быстрые действия', launch: 'Запустить рабочий процесс', forgeDesc: 'Мгновенно превращает исходники в вирусные шорт-форматы.' },
      stats: { title: 'Обзор показателей', subtitle: 'AI-инсайты для подключённых аккаунтов.', viewDetailed: 'Подробнее' },
    },
    settings: {
      subtitle: 'Управление аккаунтом, настройками и интеграциями.',
      sections: {
        general: { title: 'Общие', subtitle: 'Настройки платформы и локализация' },
        notifications: { title: 'Уведомления', subtitle: 'Настройте получение оповещений' },
        privacy: { title: 'Приватность', subtitle: 'Управление данными и согласиями' },
        security: { title: 'Безопасность', subtitle: 'Защита аккаунта и учётных данных' },
        brand: { title: 'Бренд-кит', subtitle: 'Сохраняйте визуальную целостность видео' },
        ai: { title: 'Настройки ИИ', subtitle: 'Оптимизация автономных процессов' },
      },
      appearance: { title: 'Внешний вид' },
      localization: { title: 'Локализация' },
      brandKit: {
        colors: 'Цвета бренда', primary: 'Основной цвет', accent: 'Акцентный цвет',
        typography: 'Типографика', headings: 'Шрифт заголовков', body: 'Шрифт текста',
        overlays: 'Оверлеи и водяные знаки', logo: 'Логотип бренда', opacity: 'Прозрачность логотипа',
        position: 'Позиция логотипа', save: 'Сохранить бренд-кит',
      },
      aiConfig: {
        autonomous: 'Автономное редактирование',
        autonomousDesc: 'Разрешить ИИ дорабатывать монтажи по трендам ниши',
        threshold: 'Порог уверенности',
        thresholdDesc: 'Минимальная уверенность ИИ для авто-публикации',
        rendering: 'Движок рендеринга',
        renderingDesc: 'Предпочитаемый движок для качественного экспорта',
      },
      danger: {
        title: 'Опасная зона', deleteAccount: 'Удалить аккаунт',
        deleteDesc: 'Окончательно удалит аккаунт и все связанные данные. Действие необратимо.',
        confirmDelete: 'Подтвердить удаление',
      },
      saving: 'Сохранение...', saved: 'Настройки обновлены', saveError: 'Не удалось обновить',
    },
    video: {
      subtitle: 'Командный центр вашего контент-интеллекта',
      loadError: 'Не удалось загрузить данные видео.',
      stats: { title: 'Телеметрия', total: 'Всего последовательностей', processed: 'Синтезировано', storage: 'Хранилище', performance: 'Чистый Retention' },
      projects: { title: 'Библиотека последовательностей', empty: 'Последовательностей нет.', create: 'Новая последовательность', recent: 'Недавний доступ' },
      filters: { all: 'Все проекты', completed: 'Завершено', processing: 'В обработке', pending: 'В ожидании', failed: 'Ошибка' },
      card: { open: 'Открыть редактор', clipsCount: '{count} клипов' },
      editTitle: 'Редактировать видео', preview: 'Превью',
      modes: {
        ai: 'AI авто-монтаж', aiDesc: 'ИИ находит хуки, удаляет паузы и нарезает клипы.',
        manual: 'Расширенный ручной редактор', manualDesc: 'Полная таймлайн-разработка для точных нарезок и сведения.',
      },
      backToModes: 'Выбор сценария', analyze: 'Анализ видео', diagnostics: 'Диагностика',
      configRules: 'Правила обработки', configRulesDesc: 'Настройте, как ИИ редактирует видео.',
      tasks: 'AI-задачи', format: 'Формат вывода', captionStyle: 'Стиль субтитров',
      start: 'Запустить AI-монтаж', processingDesc: 'ИИ анализирует, нарезает и оптимизирует видео...',
      complete: 'Обработка завершена', completeDesc: 'ИИ закончил монтаж видео.',
    },
    calendar: {
      title: 'Контент-календарь', subtitle: 'Управляйте мультиплатформенным расписанием.',
      addPost: 'Запланировать пост', rescheduled: 'Пост перенесён', editInScheduler: 'Открыть в планировщике',
    },
    teams: {
      title: 'Команды', subtitle: 'Сотрудничайте с редакторами, ревьюерами и контрибьюторами.',
      search: 'Поиск команд...', create: 'Новая команда', createFirst: 'Создать первую команду',
      noTeams: 'Команд нет', created: 'Команда создана',
      members: 'Участники', proFeature: 'Pro-коллаборация', proDesc: 'Продвинутые права и общие библиотеки ассетов.',
      createSubtitle: 'Пригласите участников после создания.',
      name: 'Название команды', description: 'Описание', noDescription: 'Описание отсутствует.',
    },
  },

  tr: {
    dashboard: {
      welcome: { morning: 'Günaydın', afternoon: 'İyi günler', evening: 'İyi akşamlar', badge: 'Click Platformu' },
      actions: { title: 'Hızlı Aksiyonlar', launch: 'Akışı başlat', forgeDesc: 'Ham çekimleri anında viral kısa formatlara çevirir.' },
      stats: { title: 'Performans Özeti', subtitle: 'Bağlı hesapların için AI içgörüleri.', viewDetailed: 'Detayı gör' },
    },
    settings: {
      subtitle: 'Hesabını, tercihlerini ve entegrasyonlarını yönet.',
      sections: {
        general: { title: 'Genel', subtitle: 'Platform tercihleri ve yerelleştirme' },
        notifications: { title: 'Bildirimler', subtitle: 'Uyarıları nasıl alacağını ayarla' },
        privacy: { title: 'Gizlilik', subtitle: 'Veri ve onaylarını yönet' },
        security: { title: 'Güvenlik', subtitle: 'Hesabını ve kimlik bilgilerini koru' },
        brand: { title: 'Marka Kiti', subtitle: 'Videolarda görsel tutarlılığı koru' },
        ai: { title: 'AI Ayarları', subtitle: 'Otonom akışları optimize et' },
      },
      appearance: { title: 'Görünüm' },
      localization: { title: 'Yerelleştirme' },
      brandKit: {
        colors: 'Marka renkleri', primary: 'Birincil renk', accent: 'Vurgu rengi',
        typography: 'Tipografi', headings: 'Başlık fontu', body: 'Gövde fontu',
        overlays: 'Bindirmeler ve filigranlar', logo: 'Marka logosu', opacity: 'Logo opaklığı',
        position: 'Logo konumu', save: 'Marka Kitini kaydet',
      },
      aiConfig: {
        autonomous: 'Otonom düzenleme',
        autonomousDesc: 'AI niş trendlerine göre kurguları rafine etsin',
        threshold: 'Güven eşiği',
        thresholdDesc: 'Otomatik yayın için minimum AI güveni',
        rendering: 'Render motoru',
        renderingDesc: 'Yüksek kaliteli dışa aktarmada tercih edilen motor',
      },
      danger: {
        title: 'Tehlike Bölgesi', deleteAccount: 'Hesabı Sil',
        deleteDesc: 'Hesabını ve tüm verileri kalıcı olarak siler. Geri alınamaz.',
        confirmDelete: 'Silmeyi onayla',
      },
      saving: 'Kaydediliyor...', saved: 'Ayarlar güncellendi', saveError: 'Güncelleme başarısız',
    },
    video: {
      subtitle: 'İçerik zekânın komuta merkezi',
      loadError: 'Video verisi yüklenemedi.',
      stats: { title: 'Telemetri', total: 'Toplam dizi', processed: 'Sentezlendi', storage: 'Depolama', performance: 'Net Retention' },
      projects: { title: 'Dizi Kütüphanesi', empty: 'Dizi bulunamadı.', create: 'Yeni dizi', recent: 'Son erişimler' },
      filters: { all: 'Tüm projeler', completed: 'Tamamlandı', processing: 'İşleniyor', pending: 'Beklemede', failed: 'Başarısız' },
      card: { open: 'Editörü aç', clipsCount: '{count} klip' },
      editTitle: 'Videoyu düzenle', preview: 'Önizleme',
      modes: {
        ai: 'AI otomatik kurgu', aiDesc: 'AI hook bulur, sessizliği siler ve klip üretir.',
        manual: 'Gelişmiş manuel editör', manualDesc: 'Hassas kesim ve mix için tam zaman çizelgesi.',
      },
      backToModes: 'Akış seçimi', analyze: 'Videoyu analiz et', diagnostics: 'Tanı',
      configRules: 'İşleme kuralları', configRulesDesc: 'AI\'nın videoyu nasıl kurgulayacağını ayarla.',
      tasks: 'AI Görevleri', format: 'Çıktı formatı', captionStyle: 'Altyazı stili',
      start: 'AI kurguyu başlat', processingDesc: 'AI videoyu analiz ediyor, kesiyor ve optimize ediyor...',
      complete: 'İşlem tamamlandı', completeDesc: 'AI video kurgusunu tamamladı.',
    },
    calendar: {
      title: 'İçerik Takvimi', subtitle: 'Çoklu platform yayın takvimini yönet ve gözden geçir.',
      addPost: 'Paylaşım planla', rescheduled: 'Paylaşım yeniden planlandı', editInScheduler: 'Planlayıcıda düzenle',
    },
    teams: {
      title: 'Takımlar', subtitle: 'Editör, gözden geçirici ve katkıda bulunanlarla çalış.',
      search: 'Takım ara...', create: 'Yeni takım', createFirst: 'İlk takımı oluştur',
      noTeams: 'Takım yok', created: 'Takım oluşturuldu',
      members: 'Üyeler', proFeature: 'Pro İşbirliği', proDesc: 'Gelişmiş izinler ve paylaşılan asset kütüphaneleri.',
      createSubtitle: 'Oluşturduktan sonra üye davet et.',
      name: 'Takım adı', description: 'Açıklama', noDescription: 'Açıklama yok.',
    },
  },

  id: {
    dashboard: {
      welcome: { morning: 'Selamat pagi', afternoon: 'Selamat siang', evening: 'Selamat malam', badge: 'Platform Click' },
      actions: { title: 'Aksi Cepat', launch: 'Mulai workflow', forgeDesc: 'Ubah materi mentah jadi paket short-form viral seketika.' },
      stats: { title: 'Ikhtisar Performa', subtitle: 'Insight AI untuk akun yang terhubung.', viewDetailed: 'Lihat detail' },
    },
    settings: {
      subtitle: 'Kelola akun, preferensi, dan integrasi.',
      sections: {
        general: { title: 'Umum', subtitle: 'Preferensi platform dan lokalisasi' },
        notifications: { title: 'Notifikasi', subtitle: 'Atur bagaimana kamu menerima peringatan' },
        privacy: { title: 'Privasi', subtitle: 'Kelola data dan persetujuanmu' },
        security: { title: 'Keamanan', subtitle: 'Lindungi akun dan kredensial' },
        brand: { title: 'Brand Kit', subtitle: 'Jaga konsistensi visual seluruh video' },
        ai: { title: 'Konfigurasi AI', subtitle: 'Optimalkan workflow otomatis' },
      },
      appearance: { title: 'Tampilan' },
      localization: { title: 'Lokalisasi' },
      brandKit: {
        colors: 'Warna brand', primary: 'Warna utama', accent: 'Warna aksen',
        typography: 'Tipografi', headings: 'Font judul', body: 'Font isi',
        overlays: 'Overlay & watermark', logo: 'Logo brand', opacity: 'Opasitas logo',
        position: 'Posisi logo', save: 'Simpan Brand Kit',
      },
      aiConfig: {
        autonomous: 'Editing otonom',
        autonomousDesc: 'Biarkan AI menyempurnakan editan sesuai tren niche',
        threshold: 'Ambang kepercayaan',
        thresholdDesc: 'Kepercayaan AI minimum untuk publikasi otomatis',
        rendering: 'Mesin render',
        renderingDesc: 'Mesin pilihan untuk ekspor berkualitas tinggi',
      },
      danger: {
        title: 'Zona Bahaya', deleteAccount: 'Hapus Akun',
        deleteDesc: 'Menghapus akun dan semua data terkait secara permanen. Tidak bisa dibatalkan.',
        confirmDelete: 'Konfirmasi penghapusan',
      },
      saving: 'Menyimpan...', saved: 'Pengaturan diperbarui', saveError: 'Gagal memperbarui',
    },
    video: {
      subtitle: 'Pusat komando intelijen kontenmu',
      loadError: 'Gagal memuat data video.',
      stats: { title: 'Telemetri', total: 'Total sequence', processed: 'Tersintesis', storage: 'Storage', performance: 'Net Retention' },
      projects: { title: 'Pustaka Sequence', empty: 'Tidak ada sequence.', create: 'Sequence baru', recent: 'Akses terbaru' },
      filters: { all: 'Semua proyek', completed: 'Selesai', processing: 'Diproses', pending: 'Tertunda', failed: 'Gagal' },
      card: { open: 'Buka editor', clipsCount: '{count} klip' },
      editTitle: 'Edit video', preview: 'Pratinjau',
      modes: {
        ai: 'AI Auto Edit', aiDesc: 'AI menemukan hook, menghapus jeda, dan membuat klip.',
        manual: 'Editor Manual Lanjutan', manualDesc: 'Timeline penuh untuk potongan dan mixing presisi.',
      },
      backToModes: 'Pilihan workflow', analyze: 'Analisis video', diagnostics: 'Diagnostik',
      configRules: 'Aturan pemrosesan', configRulesDesc: 'Atur cara AI mengedit videomu.',
      tasks: 'Tugas AI', format: 'Format output', captionStyle: 'Gaya caption',
      start: 'Mulai editing AI', processingDesc: 'AI sedang menganalisis, memotong, dan mengoptimalkan video...',
      complete: 'Pemrosesan selesai', completeDesc: 'AI selesai mengedit videomu.',
    },
    calendar: {
      title: 'Kalender Konten', subtitle: 'Kelola dan tinjau jadwal lintas platform.',
      addPost: 'Jadwalkan post', rescheduled: 'Post dijadwalkan ulang', editInScheduler: 'Edit di scheduler',
    },
    teams: {
      title: 'Tim', subtitle: 'Berkolaborasi dengan editor, reviewer, dan kontributor.',
      search: 'Cari tim...', create: 'Tim baru', createFirst: 'Buat tim pertama',
      noTeams: 'Tidak ada tim', created: 'Tim dibuat',
      members: 'Anggota', proFeature: 'Kolaborasi Pro', proDesc: 'Izin lanjutan dan pustaka aset bersama.',
      createSubtitle: 'Undang anggota setelah dibuat.',
      name: 'Nama tim', description: 'Deskripsi', noDescription: 'Tidak ada deskripsi.',
    },
  },

  vi: {
    dashboard: {
      welcome: { morning: 'Chào buổi sáng', afternoon: 'Chào buổi chiều', evening: 'Chào buổi tối', badge: 'Nền tảng Click' },
      actions: { title: 'Hành động nhanh', launch: 'Khởi chạy luồng', forgeDesc: 'Biến tư liệu thô thành các gói short-form viral ngay lập tức.' },
      stats: { title: 'Tổng quan hiệu suất', subtitle: 'Insight AI cho các tài khoản đã kết nối.', viewDetailed: 'Xem chi tiết' },
    },
    settings: {
      subtitle: 'Quản lý tài khoản, tuỳ chọn và tích hợp.',
      sections: {
        general: { title: 'Chung', subtitle: 'Tuỳ chọn nền tảng và bản địa hoá' },
        notifications: { title: 'Thông báo', subtitle: 'Cấu hình cách bạn nhận cảnh báo' },
        privacy: { title: 'Riêng tư', subtitle: 'Quản lý dữ liệu và sự đồng ý' },
        security: { title: 'Bảo mật', subtitle: 'Bảo vệ tài khoản và thông tin đăng nhập' },
        brand: { title: 'Brand Kit', subtitle: 'Giữ nhất quán hình ảnh trên các video' },
        ai: { title: 'Cấu hình AI', subtitle: 'Tối ưu hoá luồng làm việc tự động' },
      },
      appearance: { title: 'Giao diện' },
      localization: { title: 'Bản địa hoá' },
      brandKit: {
        colors: 'Màu thương hiệu', primary: 'Màu chính', accent: 'Màu nhấn',
        typography: 'Phông chữ', headings: 'Phông tiêu đề', body: 'Phông nội dung',
        overlays: 'Lớp phủ và watermark', logo: 'Logo thương hiệu', opacity: 'Độ mờ logo',
        position: 'Vị trí logo', save: 'Lưu Brand Kit',
      },
      aiConfig: {
        autonomous: 'Chỉnh sửa tự động',
        autonomousDesc: 'Cho phép AI tinh chỉnh edit theo xu hướng niche',
        threshold: 'Ngưỡng tin cậy',
        thresholdDesc: 'Mức tin cậy AI tối thiểu để đăng tự động',
        rendering: 'Bộ render',
        renderingDesc: 'Engine ưu tiên cho xuất bản chất lượng cao',
      },
      danger: {
        title: 'Vùng Nguy Hiểm', deleteAccount: 'Xoá tài khoản',
        deleteDesc: 'Xoá vĩnh viễn tài khoản và mọi dữ liệu liên quan. Không thể hoàn tác.',
        confirmDelete: 'Xác nhận xoá',
      },
      saving: 'Đang lưu...', saved: 'Đã cập nhật cài đặt', saveError: 'Cập nhật thất bại',
    },
    video: {
      subtitle: 'Trung tâm điều khiển trí tuệ nội dung của bạn',
      loadError: 'Không tải được dữ liệu video.',
      stats: { title: 'Đo lường', total: 'Tổng chuỗi', processed: 'Đã tổng hợp', storage: 'Lưu trữ', performance: 'Net Retention' },
      projects: { title: 'Thư viện chuỗi', empty: 'Không có chuỗi nào.', create: 'Chuỗi mới', recent: 'Truy cập gần đây' },
      filters: { all: 'Tất cả dự án', completed: 'Hoàn tất', processing: 'Đang xử lý', pending: 'Chờ xử lý', failed: 'Thất bại' },
      card: { open: 'Mở editor', clipsCount: '{count} clip' },
      editTitle: 'Chỉnh sửa video', preview: 'Xem trước',
      modes: {
        ai: 'AI tự chỉnh', aiDesc: 'AI tìm hook, xoá khoảng lặng và tạo clip.',
        manual: 'Editor thủ công nâng cao', manualDesc: 'Timeline đầy đủ cho cắt và mix chính xác.',
      },
      backToModes: 'Chọn quy trình', analyze: 'Phân tích video', diagnostics: 'Chẩn đoán',
      configRules: 'Quy tắc xử lý', configRulesDesc: 'Cấu hình cách AI chỉnh video.',
      tasks: 'Tác vụ AI', format: 'Định dạng đầu ra', captionStyle: 'Kiểu phụ đề',
      start: 'Bắt đầu chỉnh AI', processingDesc: 'AI đang phân tích, cắt và tối ưu video...',
      complete: 'Hoàn tất xử lý', completeDesc: 'AI đã chỉnh sửa xong video.',
    },
    calendar: {
      title: 'Lịch nội dung', subtitle: 'Quản lý và xem lại lịch nội dung đa nền tảng.',
      addPost: 'Lên lịch bài đăng', rescheduled: 'Đã đổi lịch', editInScheduler: 'Sửa trong scheduler',
    },
    teams: {
      title: 'Đội nhóm', subtitle: 'Cộng tác với biên tập viên, reviewer và cộng tác viên.',
      search: 'Tìm đội nhóm...', create: 'Đội mới', createFirst: 'Tạo đội đầu tiên',
      noTeams: 'Chưa có đội', created: 'Đã tạo đội',
      members: 'Thành viên', proFeature: 'Cộng tác Pro', proDesc: 'Quyền nâng cao và thư viện asset chung.',
      createSubtitle: 'Mời thành viên sau khi tạo.',
      name: 'Tên đội', description: 'Mô tả', noDescription: 'Không có mô tả.',
    },
  },

  pl: {
    dashboard: {
      welcome: { morning: 'Dzień dobry', afternoon: 'Dzień dobry', evening: 'Dobry wieczór', badge: 'Platforma Click' },
      actions: { title: 'Szybkie akcje', launch: 'Uruchom workflow', forgeDesc: 'Błyskawicznie zamień materiał źródłowy w wirusowe pakiety short-form.' },
      stats: { title: 'Przegląd wyników', subtitle: 'Insighty AI dla podłączonych kont.', viewDetailed: 'Zobacz szczegóły' },
    },
    settings: {
      subtitle: 'Zarządzaj kontem, preferencjami i integracjami.',
      sections: {
        general: { title: 'Ogólne', subtitle: 'Preferencje platformy i lokalizacja' },
        notifications: { title: 'Powiadomienia', subtitle: 'Skonfiguruj odbieranie alertów' },
        privacy: { title: 'Prywatność', subtitle: 'Zarządzaj danymi i zgodami' },
        security: { title: 'Bezpieczeństwo', subtitle: 'Chroń konto i dane logowania' },
        brand: { title: 'Brand Kit', subtitle: 'Utrzymuj spójność wizualną w filmach' },
        ai: { title: 'Konfiguracja AI', subtitle: 'Optymalizuj autonomiczne workflow' },
      },
      appearance: { title: 'Wygląd' },
      localization: { title: 'Lokalizacja' },
      brandKit: {
        colors: 'Kolory marki', primary: 'Kolor główny', accent: 'Kolor akcentu',
        typography: 'Typografia', headings: 'Czcionka nagłówków', body: 'Czcionka treści',
        overlays: 'Nakładki i znaki wodne', logo: 'Logo marki', opacity: 'Krycie logo',
        position: 'Pozycja logo', save: 'Zapisz Brand Kit',
      },
      aiConfig: {
        autonomous: 'Edycja autonomiczna',
        autonomousDesc: 'Pozwól AI dostrajać montaż wg trendów niszy',
        threshold: 'Próg pewności',
        thresholdDesc: 'Minimalna pewność AI dla automatycznej publikacji',
        rendering: 'Silnik renderowania',
        renderingDesc: 'Preferowany silnik dla eksportów wysokiej jakości',
      },
      danger: {
        title: 'Strefa zagrożenia', deleteAccount: 'Usuń konto',
        deleteDesc: 'Trwale usuwa konto i wszystkie powiązane dane. Nie można cofnąć.',
        confirmDelete: 'Potwierdź usunięcie',
      },
      saving: 'Zapisywanie...', saved: 'Zaktualizowano ustawienia', saveError: 'Nie udało się zaktualizować',
    },
    video: {
      subtitle: 'Centrum dowodzenia twojej content intelligence',
      loadError: 'Nie udało się załadować danych wideo.',
      stats: { title: 'Telemetria', total: 'Wszystkie sekwencje', processed: 'Zsyntetyzowane', storage: 'Pamięć', performance: 'Net Retention' },
      projects: { title: 'Biblioteka sekwencji', empty: 'Brak sekwencji.', create: 'Nowa sekwencja', recent: 'Ostatnio otwierane' },
      filters: { all: 'Wszystkie projekty', completed: 'Ukończone', processing: 'Przetwarzanie', pending: 'Oczekujące', failed: 'Nieudane' },
      card: { open: 'Otwórz edytor', clipsCount: '{count} klipów' },
      editTitle: 'Edytuj wideo', preview: 'Podgląd',
      modes: {
        ai: 'AI auto-edycja', aiDesc: 'AI znajduje hooki, usuwa pauzy i tworzy klipy.',
        manual: 'Zaawansowany edytor ręczny', manualDesc: 'Pełna oś czasu do precyzyjnych cięć i miksowania.',
      },
      backToModes: 'Wybór workflow', analyze: 'Analizuj wideo', diagnostics: 'Diagnostyka',
      configRules: 'Reguły przetwarzania', configRulesDesc: 'Skonfiguruj jak AI edytuje wideo.',
      tasks: 'Zadania AI', format: 'Format wyjściowy', captionStyle: 'Styl napisów',
      start: 'Rozpocznij edycję AI', processingDesc: 'AI analizuje, tnie i optymalizuje twoje wideo...',
      complete: 'Przetwarzanie zakończone', completeDesc: 'AI dokończyło montaż wideo.',
    },
    calendar: {
      title: 'Kalendarz treści', subtitle: 'Zarządzaj i przeglądaj harmonogram cross-platform.',
      addPost: 'Zaplanuj post', rescheduled: 'Post przełożony', editInScheduler: 'Edytuj w schedulerze',
    },
    teams: {
      title: 'Zespoły', subtitle: 'Współpracuj z edytorami, recenzentami i kontrybutorami.',
      search: 'Szukaj zespołów...', create: 'Nowy zespół', createFirst: 'Utwórz pierwszy zespół',
      noTeams: 'Brak zespołów', created: 'Zespół utworzony',
      members: 'Członkowie', proFeature: 'Współpraca Pro', proDesc: 'Zaawansowane uprawnienia i współdzielone biblioteki zasobów.',
      createSubtitle: 'Zaproś członków po utworzeniu.',
      name: 'Nazwa zespołu', description: 'Opis', noDescription: 'Brak opisu.',
    },
  },

  nl: {
    dashboard: {
      welcome: { morning: 'Goedemorgen', afternoon: 'Goedemiddag', evening: 'Goedenavond', badge: 'Click-platform' },
      actions: { title: 'Snelle acties', launch: 'Workflow starten', forgeDesc: 'Verandert ruw materiaal direct in virale short-form pakketten.' },
      stats: { title: 'Prestatieoverzicht', subtitle: 'AI-inzichten voor je gekoppelde accounts.', viewDetailed: 'Details bekijken' },
    },
    settings: {
      subtitle: 'Beheer je account, voorkeuren en integraties.',
      sections: {
        general: { title: 'Algemeen', subtitle: 'Platformvoorkeuren en lokalisatie' },
        notifications: { title: 'Meldingen', subtitle: 'Stel in hoe je waarschuwingen ontvangt' },
        privacy: { title: 'Privacy', subtitle: 'Beheer je data en toestemmingen' },
        security: { title: 'Beveiliging', subtitle: 'Bescherm je account en inloggegevens' },
        brand: { title: 'Brand Kit', subtitle: 'Houd visuele consistentie over je videos' },
        ai: { title: 'AI-configuratie', subtitle: 'Optimaliseer autonome workflows' },
      },
      appearance: { title: 'Weergave' },
      localization: { title: 'Lokalisatie' },
      brandKit: {
        colors: 'Brand-kleuren', primary: 'Primaire kleur', accent: 'Accentkleur',
        typography: 'Typografie', headings: 'Kopfont', body: 'Bodyfont',
        overlays: 'Overlays en watermerken', logo: 'Brand-logo', opacity: 'Logo-dekking',
        position: 'Logo-positie', save: 'Brand Kit opslaan',
      },
      aiConfig: {
        autonomous: 'Autonome bewerking',
        autonomousDesc: 'Laat AI montages bijschaven volgens nichetrends',
        threshold: 'Vertrouwensdrempel',
        thresholdDesc: 'Minimale AI-zekerheid voor automatisch publiceren',
        rendering: 'Rendering-engine',
        renderingDesc: 'Voorkeurs-engine voor hoge-kwaliteit exports',
      },
      danger: {
        title: 'Gevaarzone', deleteAccount: 'Account verwijderen',
        deleteDesc: 'Verwijdert je account en alle data permanent. Niet ongedaan te maken.',
        confirmDelete: 'Bevestig verwijdering',
      },
      saving: 'Opslaan...', saved: 'Instellingen bijgewerkt', saveError: 'Bijwerken mislukt',
    },
    video: {
      subtitle: 'Commandocentrum van jouw content-intelligence',
      loadError: 'Videodata laden mislukt.',
      stats: { title: 'Telemetrie', total: 'Totaal sequenties', processed: 'Gesynthetiseerd', storage: 'Opslag', performance: 'Net Retention' },
      projects: { title: 'Sequentie-bibliotheek', empty: 'Geen sequenties.', create: 'Nieuwe sequentie', recent: 'Recent geopend' },
      filters: { all: 'Alle projecten', completed: 'Voltooid', processing: 'Bezig', pending: 'In behandeling', failed: 'Mislukt' },
      card: { open: 'Editor openen', clipsCount: '{count} clips' },
      editTitle: 'Video bewerken', preview: 'Voorbeeld',
      modes: {
        ai: 'AI auto-bewerking', aiDesc: 'AI vindt hooks, verwijdert stiltes en genereert clips.',
        manual: 'Geavanceerde handmatige editor', manualDesc: 'Volledige tijdlijn voor precieze cuts en mixing.',
      },
      backToModes: 'Workflow-keuze', analyze: 'Video analyseren', diagnostics: 'Diagnostiek',
      configRules: 'Verwerkingsregels', configRulesDesc: 'Stel in hoe AI je video bewerkt.',
      tasks: 'AI-taken', format: 'Uitvoerformaat', captionStyle: 'Ondertitelstijl',
      start: 'AI-bewerking starten', processingDesc: 'AI analyseert, knipt en optimaliseert je video...',
      complete: 'Verwerking voltooid', completeDesc: 'AI heeft je video bewerkt.',
    },
    calendar: {
      title: 'Content-kalender', subtitle: 'Beheer en bekijk je cross-platform planning.',
      addPost: 'Post inplannen', rescheduled: 'Post opnieuw ingepland', editInScheduler: 'Bewerk in planner',
    },
    teams: {
      title: 'Teams', subtitle: 'Werk samen met editors, reviewers en contributors.',
      search: 'Zoek teams...', create: 'Nieuw team', createFirst: 'Maak je eerste team',
      noTeams: 'Geen teams', created: 'Team aangemaakt',
      members: 'Leden', proFeature: 'Pro Samenwerking', proDesc: 'Uitgebreide rechten en gedeelde asset-bibliotheken.',
      createSubtitle: 'Nodig leden uit na aanmaken.',
      name: 'Teamnaam', description: 'Beschrijving', noDescription: 'Geen beschrijving.',
    },
  },

  th: {
    dashboard: {
      welcome: { morning: 'อรุณสวัสดิ์', afternoon: 'สวัสดีตอนบ่าย', evening: 'สวัสดีตอนเย็น', badge: 'แพลตฟอร์ม Click' },
      actions: { title: 'การกระทำด่วน', launch: 'เริ่มเวิร์กโฟลว์', forgeDesc: 'แปลงฟุตเทจดิบเป็นแพ็กวิดีโอสั้นไวรัลทันที' },
      stats: { title: 'ภาพรวมประสิทธิภาพ', subtitle: 'อินไซต์ AI สำหรับบัญชีที่เชื่อมต่อ', viewDetailed: 'ดูรายละเอียด' },
    },
    settings: {
      subtitle: 'จัดการบัญชี การตั้งค่า และการเชื่อมต่อ',
      sections: {
        general: { title: 'ทั่วไป', subtitle: 'การตั้งค่าแพลตฟอร์มและการแปล' },
        notifications: { title: 'การแจ้งเตือน', subtitle: 'กำหนดวิธีรับการแจ้งเตือน' },
        privacy: { title: 'ความเป็นส่วนตัว', subtitle: 'จัดการข้อมูลและความยินยอม' },
        security: { title: 'ความปลอดภัย', subtitle: 'ปกป้องบัญชีและข้อมูลรับรอง' },
        brand: { title: 'แบรนด์คิต', subtitle: 'รักษาความสม่ำเสมอภาพในวิดีโอ' },
        ai: { title: 'การตั้งค่า AI', subtitle: 'เพิ่มประสิทธิภาพเวิร์กโฟลว์อัตโนมัติ' },
      },
      appearance: { title: 'รูปลักษณ์' },
      localization: { title: 'การแปล' },
      brandKit: {
        colors: 'สีแบรนด์', primary: 'สีหลัก', accent: 'สีเน้น',
        typography: 'ฟอนต์', headings: 'ฟอนต์หัวเรื่อง', body: 'ฟอนต์เนื้อหา',
        overlays: 'โอเวอร์เลย์และวอเตอร์มาร์ก', logo: 'โลโก้แบรนด์', opacity: 'ความทึบของโลโก้',
        position: 'ตำแหน่งโลโก้', save: 'บันทึกแบรนด์คิต',
      },
      aiConfig: {
        autonomous: 'แก้ไขอัตโนมัติ',
        autonomousDesc: 'ให้ AI ปรับแต่งการตัดต่อตามเทรนด์ของช่อง',
        threshold: 'เกณฑ์ความมั่นใจ',
        thresholdDesc: 'ความมั่นใจ AI ขั้นต่ำสำหรับการเผยแพร่อัตโนมัติ',
        rendering: 'เอนจินเรนเดอร์',
        renderingDesc: 'เอนจินที่ต้องการสำหรับเอ็กซ์พอร์ตคุณภาพสูง',
      },
      danger: {
        title: 'โซนอันตราย', deleteAccount: 'ลบบัญชี',
        deleteDesc: 'ลบบัญชีและข้อมูลทั้งหมดถาวร ย้อนกลับไม่ได้',
        confirmDelete: 'ยืนยันการลบ',
      },
      saving: 'กำลังบันทึก...', saved: 'อัปเดตการตั้งค่าแล้ว', saveError: 'อัปเดตไม่สำเร็จ',
    },
    video: {
      subtitle: 'ศูนย์บัญชาการความฉลาดของคอนเทนต์',
      loadError: 'โหลดข้อมูลวิดีโอล้มเหลว',
      stats: { title: 'การวัดผล', total: 'จำนวนซีเควนซ์', processed: 'สังเคราะห์แล้ว', storage: 'พื้นที่จัดเก็บ', performance: 'Net Retention' },
      projects: { title: 'คลังซีเควนซ์', empty: 'ไม่พบซีเควนซ์', create: 'ซีเควนซ์ใหม่', recent: 'เข้าถึงล่าสุด' },
      filters: { all: 'ทุกโปรเจ็กต์', completed: 'เสร็จแล้ว', processing: 'กำลังประมวลผล', pending: 'รอดำเนินการ', failed: 'ล้มเหลว' },
      card: { open: 'เปิดเอดิเตอร์', clipsCount: '{count} คลิป' },
      editTitle: 'แก้ไขวิดีโอ', preview: 'ดูตัวอย่าง',
      modes: {
        ai: 'AI ตัดต่ออัตโนมัติ', aiDesc: 'AI หาฮุก ลบเสียงเงียบ และสร้างคลิป',
        manual: 'เอดิเตอร์มือขั้นสูง', manualDesc: 'ไทม์ไลน์เต็มสำหรับตัดต่อและมิกซ์อย่างแม่นยำ',
      },
      backToModes: 'เลือกเวิร์กโฟลว์', analyze: 'วิเคราะห์วิดีโอ', diagnostics: 'การวินิจฉัย',
      configRules: 'กฎการประมวลผล', configRulesDesc: 'ตั้งค่าวิธีที่ AI ตัดต่อวิดีโอ',
      tasks: 'งาน AI', format: 'รูปแบบเอาต์พุต', captionStyle: 'สไตล์ซับ',
      start: 'เริ่มตัดต่อ AI', processingDesc: 'AI กำลังวิเคราะห์ ตัด และปรับวิดีโอให้เหมาะสม...',
      complete: 'ประมวลผลเสร็จสิ้น', completeDesc: 'AI ตัดต่อวิดีโอเสร็จแล้ว',
    },
    calendar: {
      title: 'ปฏิทินคอนเทนต์', subtitle: 'จัดการและตรวจตารางข้ามแพลตฟอร์ม',
      addPost: 'จัดตารางโพสต์', rescheduled: 'จัดตารางใหม่แล้ว', editInScheduler: 'แก้ไขในตัวจัดตาราง',
    },
    teams: {
      title: 'ทีม', subtitle: 'ทำงานร่วมกับครีเอเตอร์ ผู้รีวิว และผู้ร่วมงาน',
      search: 'ค้นหาทีม...', create: 'ทีมใหม่', createFirst: 'สร้างทีมแรก',
      noTeams: 'ไม่มีทีม', created: 'สร้างทีมแล้ว',
      members: 'สมาชิก', proFeature: 'การทำงานร่วม Pro', proDesc: 'สิทธิ์ขั้นสูงและคลังแอสเซตที่แชร์',
      createSubtitle: 'เชิญสมาชิกหลังจากสร้าง',
      name: 'ชื่อทีม', description: 'คำอธิบาย', noDescription: 'ไม่มีคำอธิบาย',
    },
  },
};

// ── Merge logic ───────────────────────────────────────────────────────────
function getPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
function flatten(obj, prefix = '') {
  const out = {};
  for (const k of Object.keys(obj)) {
    const p = prefix ? prefix + '.' + k : k;
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, p));
    else out[p] = v;
  }
  return out;
}

function buildMergedLocale(localeCode) {
  const stale = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, localeCode + '.json'), 'utf8'));
  const newPart = NEW_TRANSLATIONS[localeCode] || {};
  const newFlat = flatten(newPart);
  const enFlat = flatten(EN);

  const out = {};
  for (const targetKey of Object.keys(enFlat)) {
    // 1. NEW translations from this script (highest priority for the new
    //    schema — they are the freshly-authored target-language strings).
    if (Object.prototype.hasOwnProperty.call(newFlat, targetKey)) {
      setPath(out, targetKey, newFlat[targetKey]);
      continue;
    }
    // 2. Existing translation at the SAME key (stable section: common, nav,
    //    workflow, ingest, sidebar, toast, errorBoundary, content, etc.).
    const existing = getPath(stale, targetKey);
    if (typeof existing === 'string') {
      setPath(out, targetKey, existing);
      continue;
    }
    // 3. Migrated key: old key was renamed → new key. Reuse the old
    //    translation so we don't have to retranslate (e.g. settings.theme →
    //    settings.appearance.theme).
    const oldKey = Object.keys(RENAMES).find(o => RENAMES[o] === targetKey);
    if (oldKey) {
      const reused = getPath(stale, oldKey);
      if (typeof reused === 'string') {
        setPath(out, targetKey, reused);
        continue;
      }
    }
    // 4. Last resort: copy the en value verbatim. Means the locale will
    //    render English for that string, but never crashes the UI. Tracked
    //    in the report below.
    setPath(out, targetKey, enFlat[targetKey]);
  }
  return out;
}

const TARGETS = ['fr','de','it','pt','ja','ko','zh-Hans','ar','hi','ru','tr','id','vi','pl','nl','th'];

let totalEnglishFallback = 0;
const report = [];

for (const code of TARGETS) {
  const merged = buildMergedLocale(code);
  fs.writeFileSync(path.join(LOCALES_DIR, code + '.json'), JSON.stringify(merged, null, 2) + '\n');
  // Count keys that ended up identical to en (English fallback).
  const enFlat = flatten(EN);
  const mergedFlat = flatten(merged);
  const fallbacks = Object.keys(enFlat).filter(k => mergedFlat[k] === enFlat[k] && enFlat[k] !== '').length;
  totalEnglishFallback += fallbacks;
  report.push({ code, keys: Object.keys(mergedFlat).length, englishFallback: fallbacks });
}

console.log('--- locale sync report ---');
console.table(report);
console.log('total English-fallback keys across 16 locales:', totalEnglishFallback);
console.log('all 16 locales now at parity with en.json (' + Object.keys(flatten(EN)).length + ' keys each).');
