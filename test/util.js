/**
 * These are some utilities for audio embeds.
 * Courtesy of Duncan Sterkan for having his original java code open source
 * Link to Original Java code:
 *
 * @author Duncan Sterkan (duncte123): Original Version
 */

module.exports = {

  /**
   * This will generate a nice player embed for us
   *
   * @param { Player } player
   * @param { Track } current
   * @author Duncan Sterkan (duncte123)
   * @returns { String } the String that we can place in our embed
   */
  playerEmbed: (player, current) => {
    return (player.paused ? "\u23F8" : "\u25B6") + " " +
      module.exports.progressBar(player.position / current.info.length) +
      `\`[${module.exports.formatTime(player.position)}/${module.exports.formatTime(current.info.length)}]\`` +
      module.exports.getVolumeIcon(player.volume);
  },

  /**
   * This will calculate the progressbar for us
   *
   * @param { Number } percent how far we are in the audio track
   * @param {Number} length The length of the progress bar.
   * @author Duncan Sterkan (duncte123)
   * @returns the progressbar
   */
  progressBar: (percent, length = 8) => {
    let str = "";
    for (let i = 0; i < length; i++) {
      if (i === Math.round(percent * length)) str += "\uD83D\uDD18";
      else str += "▬";
    }
    return str;
  },

  /**
   * This will give a nice emote depending on how loud we are sending the music
   *
   * @param { Number } volume the volume of our player
   * @author Duncan Sterkan (duncte123)
   * @returns the volume icon emote
   */
  getVolumeIcon: volume => {
    if (volume === 0) return "\uD83D\uDD07";
    else if (volume < 33) return "\uD83D\uDD08";
    else if (volume < 67) return "\uD83D\uDD09";
    else return "\uD83D\uDD0A";
  },

  /**
   * This wil format our current player time in this format: mm:ss
   *
   * @param { Number } duration how far we are in the track
   * @author MeLike2D
   * @returns our formatted time
   */
  formatTime: duration => {
    let minutes = Math.floor(duration / 60000);
    let seconds = ((duration % 60000) / 1000).toFixed(0);
    return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
  }
};
