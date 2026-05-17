import { Config } from '@remotion/cli/config'

Config.setEntryPoint('./remotion/Root.tsx')
Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
Config.setConcurrency(1)
Config.setChromiumOpenGlRenderer('angle-egl')
