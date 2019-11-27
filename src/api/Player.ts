import {EventEmitter} from "events";
import {Node} from "./Node";
import {AndesitePlayer, FilterMap, FilterNames} from "../interfaces/Entities";
import {Packet, VoiceServerUpdate, VoiceStateUpdate} from "../Manager";
import {RESTManager} from "./RESTManager";

export interface PlayerOptions {
  guildId: string;
  channelId: string;
}

export interface PlayOptions {
  start?: number;
  end?: number;
  pause?: boolean;
  volume?: number;
  noReplace?: boolean;
}

/**
 * The Player used for playing songs.
 * @extends EventEmitter
 */
export class Player extends EventEmitter {
  /**
   * The guild that the player is in charge of.
   */
  public guildId: string;
  /**
   * The channel that the player is in.
   */
  public channelId: string;
  /**
   * The current position of the playing track.
   */
  public position: number = 0;
  /**
   * The current filter values;
   */
  public filters: FilterMap = <FilterMap>{};
  /**
   * Whether the player is paused or not.
   */
  public paused: boolean = false;
  /**
   * The current volume.
   */
  public volume: number;
  /**
   * The current track that is being played.
   */
  public track: string | null = null;
  /**
   * Whether the player is playing a track or not.
   */
  public playing: boolean = false;
  /**
   * Timestamp of which the player started playing a track.
   */
  public timestamp: number | null = null;

  /**
   * The rest manager of this players node.
   */
  public rest: RESTManager;
  /**
   * The andesite player object. Direct access to the andesite player.
   */
  private _player?: AndesitePlayer;
  /**
   * The endpoint used in "/player/:guild_id" requests.
   */
  private readonly _endpoint: string;
  /**
   * The voice server that this player is using.
   */
  private voiceServer?: VoiceServerUpdate;
  /**
   * The state of the voice connection.
   */
  private voiceState?: VoiceStateUpdate;

  public constructor(
    public node: Node,
    public readonly options: PlayerOptions
  ) {
    super();

    this._endpoint = `/player/${options.guildId}`;
    this.guildId = options.guildId;
    this.volume = node.manager.defaultVolume;
    this.channelId = options.channelId;
    this.rest = node.rest;
  }

  /**
   * Plays a base64 track from lavaplayer.
   * @param track The base64 track.
   * @param options Options used when playing the track.
   * @memberof Player
   */
  public play(track: string, options?: PlayOptions) {
    this.playing = true;
    this.timestamp = Date.now();
    this.track = track;

    return this.node._send(`play`, {
      volume: this.node.manager.defaultVolume,
      ...options,
      track,
      guildId: this.guildId,
      noReplace: false
    });
  }

  /**
   * Pauses the player if not already.
   * @memberof Player
   */
  public pause(): Promise<AndesitePlayer> {
    return this.rest.patch(`${this._endpoint}/pause`, {
      pause: true
    });
  }

  /**
   * Resumes the player if paused.
   * @memberof Player
   */
  public resume(): Promise<AndesitePlayer> {
    return this.rest.patch(`${this._endpoint}/pause`, {
      pause: false
    });
  }

  /**
   * Change the current volume.
   * @param value The value to use.
   * @memberof Player
   */
  public setVolume(value: number): Promise<AndesitePlayer> {
    return this.rest.patch(`${this._endpoint}/volume`, {
      volume: value
    });
  }

  /**
   * Seek to a position in the current playing track.
   * @param position
   * @memberof Player
   */
  public seek(position: number): Promise<AndesitePlayer> {
    return this.rest.patch(`${this._endpoint}/seek`, {
      position
    });
  }

  /**
   * Manage a filter.
   * @param filter The filter name to manage
   * @param options Options for the filter, you can omit this.
   * @memberof Player
   */
  public filter<F extends FilterNames>(filter: F, options?: FilterMap[F]): Promise<AndesitePlayer> {
    return this.rest.patch(`${this._endpoint}/filters`, {
      [`${filter}`]: options || {}
    });
  }

  /**
   * Stops the player from playing audio.
   * @memberof Player
   */
  public stop(): Promise<AndesitePlayer> {
    this.playing = false;
    this.timestamp = null;
    this.track = null;
    return this.rest.post(`${this._endpoint}/stop`)
  }

  /**
   * Destroys the player.
   * @memberof Player
   */
  public destroy() {
    return this.rest.delete(this._endpoint);
  }

  /**
   * Updates this player with the latest values.
   * @param pk
   * @private
   * @memberof Player
   */
  public async _update(pk: any) {
    switch (pk.op) {
      case "player-update":
        this._player = pk.state;
        this.filters = pk.state.filters;
        this.volume = pk.state.volume;
        this.position = pk.state.position || this.position || 0;
        this.paused = pk.state.paused;
        break;
      case "event":
        const emit = (event: string, data: any) => this.listenerCount(event) ? this.emit(event, data) : null;
        switch (pk.type) {
          case "TrackEndEvent": {
            if (pk.reason !== "REPLACED") this.playing = false;
            this.timestamp = null;
            this.track = null;

            emit("end", pk);
            break;
          }
          case "TrackExceptionEvent":
            emit("error", pk);
            break;
          case "TrackStuckEvent":
            await this.stop();
            emit("end", pk);
            break;
          case "WebSocketClosedEvent":
            emit("error", pk);
            break;
          default:
            emit("warn", `Unexpected event type "${pk.type}"`);
            break;
        }
    }
  }

  /**
   * Resumes the player after moving to another node.
   * @private
   * @memberof Player
   */
  async _moved() {
    try {
      if (!this.track) return this.emit("error", "no track found upon moving to another node.");

      await this.play(this.track, {start: this._player!.position});
      if (this.filters.equalizer.bands.length) await this.filter("equalizer", {bands: this.filters.equalizer.bands});
      if (this.volume !== 100) await this.setVolume(this.volume);
      this.emit("moved", this.guildId, this.node.name);
    } catch (e) {

    }
  }

  /**
   * Update the voice server & voice state.
   * @param pk
   * @private
   * @memberof Player
   */
  async _voiceUpdate(pk: Packet) {
    switch (pk.t) {
      case "VOICE_STATE_UPDATE":
        this.voiceState = pk.d;
        break;
      case "VOICE_SERVER_UPDATE":
        this.voiceServer = pk.d;
        await this.node._send("voice-server-update", {
          guildId: this.guildId,
          sessionId: this.voiceState!.session_id,
          event: this.voiceServer
        });
        break;
    }
  }
}