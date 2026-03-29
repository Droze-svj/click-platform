/**
 * Remotion root: register compositions.
 * Run: npx remotion studio remotion/Root.tsx (after npm install remotion @remotion/cli)
 * Remotion injects `frame` and `fps` into the component; defaultProps can be empty.
 */

import { registerRoot } from 'remotion'
import { Composition } from 'remotion'
import { ClickComposition } from './ClickComposition'

registerRoot(() => (
  <>
    <Composition
      id="ClickComposition"
      component={ClickComposition}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  </>
))
