const ffmpeg = require('fluent-ffmpeg');
const cmd = ffmpeg('input.mp4');
cmd.videoFilters(['split[bg][fg];[bg]scale=1080:1920[bg_out]']);
console.log(cmd._getArguments().join(' '));
