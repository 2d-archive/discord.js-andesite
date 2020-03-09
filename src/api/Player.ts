import { EventEmitter } from "events";
import { AndesitePlayer, FilterMap } from "../interfaces/Entities";
import { VoiceServerUpdate, VoiceStateUpdate } from "../Manager";
import { Node } from "./Node";
import { RESTManager } from "./RESTManager";

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
  public volume: number = 100;
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
   * The voice server that this player is using.
   * @private
   */
  public _voiceServer?: VoiceServerUpdate;
  /**
   * The state of the voice connection.
   * @private
   */
  public _voiceState?: VoiceStateUpdate;
  /**
   * The endpoint used in "/player/:guild_id" requests.
   * @private
   */
  public readonly _endpoint: string;
  /**
   * The andesite player object. Direct access to the andesite player.
   * @private
   */
  private _player?: AndesitePlayer;
  /**
   * Indicates whether the player is in the middle of moving channels
   * @private
   */
  private movingChannels: boolean = false;

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
   * @param {string} track - The base64 track.
   * @param {PlayOptions} [options={}] - Options used when playing the track.
   * @memberof Player
   */
  public play(track: string, options: PlayOptions = {}): Promise<boolean> {
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
   * @param value - The value to use.
   * @memberof Player
   */
  public setVolume(value: number): Promise<AndesitePlayer> {
    return this.rest.patch(`${this._endpoint}/volume`, {
      volume: value
    });
  }

  /**
   * Seek to a position in the current playing track.
   * @param {number} position - The position to seek to.
   * @memberof Player
   */
  public seek(position: number): Promise<AndesitePlayer> {
    return this.rest.patch(`${this._endpoint}/seek`, {
      position
    });
  }

  /**
   * Manage a filter.
   * @param {FilterNames} filter - The filter name to manage
   * @param {object} options - Options for the filter, you can omit this.
   * @memberof Player
   */
  public filter<F extends keyof FilterMap>(
    filter: F,
    options?: FilterMap[F]
  ): Promise<AndesitePlayer> {
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
    return this.rest.post(`${this._endpoint}/stop`);
  }

  /**
   * Destroys the player.
   * @memberof Player
   */
  public destroy(): Promise<AndesitePlayer> {
    return this.rest.delete(this._endpoint);
  }

  /**
   * Updates this player with the latest values.
   * @param pk
   * @private
   * @memberof Player
   */
  public async _update(pk: Record<string, any>): Promise<void> {
    switch (pk.op) {
      case "player-update":
        this._player = pk.state;
        this.filters = pk.state.filters;
        this.volume = pk.state.volume;
        this.position = pk.state.position || this.position || 0;
        this.paused = pk.state.paused;
        break;
      case "event":
        const emit = (event: string, data: any) =>
          this.listenerCount(event) ? this.emit(event, data) : null;
        switch (pk.type) {
          case "TrackEndEvent": {
            if (!this.movingChannels) {
              if (pk.reason !== "REPLACED") this.playing = false;
              this.timestamp = null;
              this.track = null;

              emit("end", pk);
            }
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
  public async _moved(node: boolean = true): Promise<boolean | void> {
    try {
      if (!this.track)
        return this.emit(
          "error",
          "no track found upon moving to another node."
        );

      await this.play(this.track, { start: this._player!.position });
      if (this.volume !== 100) await this.setVolume(this.volume);
      if (node) this.emit("moved", this.guildId, this.node.name);
    } catch (e) {
      return this.emit("error", e);
    }
  }

  /**
   * Moves the player to another voice channel
   * ! This isn't reliable, we don't recommend using this.
   * @param {string} channelId - The voice channel id to move to.
   * @param {boolean} [reset=false] - Whether to reset the player. (not recommended)
   */
  public async moveVoiceChannel(
    channelId: string,
    reset: boolean = false
  ): Promise<boolean> {
    this.movingChannels = true;
    if (this.channelId === channelId) return Promise.reject(false);

    // await this.destroy();

    this.channelId = channelId;
    this.node.join(
      { guildId: this.guildId, channelId },
      {
        selfdeaf: this._voiceState.self_deaf,
        selfmute: this._voiceState.self_mute
      }
    );
    this._voiceUpdate();

    if (!reset) await this._moved(false);
    this.movingChannels = false;
    return Promise.resolve(true);
  }

  /**
   * Update the voice server & voice state.
   * @private
   * @memberof Player
   */
  public async _voiceUpdate(): Promise<void> {
    await this.node._send("voice-server-update", {
      guildId: this.guildId,
      event: this._voiceServer,
      sessionId: this._voiceState!.session_id
    });
  }
}
