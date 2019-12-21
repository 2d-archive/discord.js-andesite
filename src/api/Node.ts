import {Manager} from "../Manager";
import {RESTManager} from "./RESTManager";
import WebSocket from "ws";
import {NodeMetadata, NodeOptions, NodeStats, NodeStatus} from "../interfaces/Node";
import {PlayerStore} from "../store/Player";
import {Player, PlayerOptions} from "./Player";

export interface JoinOptions {
  selfmute?: boolean;
  selfdeaf?: boolean
}

export class Node {
  /**
   * The connection id from the node.
   */
  public id?: number;
  /**
   * Metadata that was provided via the node.
   */
  public meta?: NodeMetadata;
  /**
   * The (andesite) node stats.
   */
  public stats!: NodeStats;
  /**
   * The state of this node.
   */
  public state: NodeStatus = NodeStatus.DISCONNECTED;
  /**
   * The name of this connection. Used for identifying.
   */
  public readonly name: string;
  /**
   * The hostname of the node.
   */
  public readonly host: string;
  /**
   * The port that the node is on.
   */
  public readonly port: string;
  /**
   * The REST Manager that is used in players.
   */
  public readonly rest!: RESTManager;
  /**
   * A collection of players that were either moved or created with Node#join
   */
  public readonly players: PlayerStore = new PlayerStore(this);

  private ws?: WebSocket;
  private tries: number = 0;
  private readonly auth!: string;
  private readonly url!: string;

  public constructor(
    public readonly manager: Manager,
    options: NodeOptions
  ) {
    this.name = options.name;
    this.host = options.host;
    this.port = String(options.port);

    Object.defineProperty(this, "rest", {value: new RESTManager(this)});
    Object.defineProperty(this, "auth", {value: options.auth});
    Object.defineProperty(this, "url", {value: `ws://${options.host}:${options.port}/websocket`});

    this._connect();
  }

  /**
   * Penalties of this node. The higher the return number, the more loaded the server is.
   * (From shoukaku... thanks!)
   */
  get penalties() {
    let penalties = 0;
    penalties += this.stats.players.playing;
    penalties += Math.round(Math.pow(1.05, 100 * this.stats.cpu.system) * 10 - 10);
    if (this.stats.frameStats) {
      penalties += this.stats.frameStats.reduce((a, fs) => a + fs.loss, 0);
    }
    return penalties;
  }

  /**
   * Whether the websocket is open / connected.
   */
  public get connected(): boolean {
    // @ts-ignore
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Sends a payload with the "get-stats" op.
   */
  public getStats(): Promise<boolean> {
    if (!this.connected) return Promise.resolve(false);
    return this._send("get-stats");
  }

  /**
   * Send a payload to the node.
   * @param op
   * @param payload
   * @private
   */
  public _send(op: string, payload?: { [key: string]: any }): Promise<boolean> {
    return new Promise((res, rej) => {
      if (!this.connected) throw new Error("this node isn't connected");
      let data;

      try {
        data = JSON.stringify({op, ...payload});
      } catch (e) {
        return rej(false);
      }

      this.ws.send(data, (e: any) => e ? rej(e) : res(true));
    });
  }

  /**
   * Creates a player and a voice connection.
   * @param data The guild & voice channel id for the player.
   * @param options The options used for creating the player.
   */
  public join(data: PlayerOptions, {selfmute = false, selfdeaf = false}: JoinOptions = {}): Player {
    const guild = this.manager.client.guilds.get(data.guildId);
    if (!guild) throw new Error(`Guild with id of ${data.guildId} doesn't exist.`);

    this.manager._send({
      op: 4,
      d: {
        channel_id: data.channelId,
        guild_id: data.guildId,
        self_mute: selfmute,
        self_deaf: selfdeaf
      }
    });

    if (this.players.has(data.guildId)) return <Player>this.players.get(data.guildId);

    return this.players.create(data);
  }

  /**
   * Destroys the player and voice connection.
   * @param guildId
   */
  public leave(guildId: string): boolean {
    const guild = this.manager.client.guilds.get(guildId);
    if (!guild) throw new Error(`Guild with id of ${guildId} doesn't exist or the client hasn't acknowledged it yet.`);

    this.manager._send({
      op: 4,
      d: {
        channel_id: null,
        guild_id: guildId,
        self_mute: null,
        self_deaf: null
      }
    });

    return this.players.delete(guildId);
  }

  /**
   * Connects to the node with a websocket..
   * @private
   */
  private async _connect(): Promise<void> {
    this.state = NodeStatus.CONNECTING;
    const headers: { [key: string]: string } = {};
    if (this.connected) this.ws.close();
    if (this.id) headers["Andesite-Resume-Id"] = String(this.id);
    if (this.auth) headers["Authorization"] = this.auth;

    this.ws = new WebSocket(this.url, {
      headers: {
        "User-Id": this.manager.userId,
        ...headers
      }
    });

    this.ws.on("error", this._error.bind(this));
    this.ws.on("message", this._message.bind(this));
    this.ws.on("open", () => this.manager.emit("open", this.name, this.id));
    this.ws.on("close", this._close.bind(this));
    await this.getStats();
  }

  /**
   * Received message from the websocket.
   * @param data
   * @private
   */
  private async _message(data: string): Promise<void> {
    const d = JSON.parse(data);

    switch (d.op) {
      case "connection-id":
        this.id = d.id;
        break;
      case "metadata":
        this.meta = d.data;
        break;
      case "stats":
        this.stats = d.data;
        break;
      case "event":
      case "player-update":
        if (this.players.has(d.guildId))
          await this.players.get(d.guildId)._update(d);
        break;
      default:
        this.manager.emit("raw", this.name, d);
    }
  }

  /**
   * Error received from the websocket.
   * @param error
   * @private
   */
  private _error(error: any): void {
    this.manager.emit("error", this.name, error);
    this.ws.close(4011, "reconnecting");
  }

  /**
   * Handles a "close" event from the websocket.
   * @param code
   * @param reason
   * @private
   */
  private _close(code: number, reason: string): Promise<void> {
    this.ws.removeAllListeners();
    this.ws = null;
    return this.reconnect(code, reason);
  }

  /**
   * Handles a node reconnect.
   * @param code
   * @param reason
   */
  private async reconnect(code: number, reason: string): Promise<void> {
    this.manager.emit("close", this.name, reason, code);
    if (this.tries < this.manager.reconnectTries) {
      this.tries++;
      try {
        await this._connect();
      } catch (e) {
        this.manager.emit('error', this.name, e);
        setInterval(() => this.reconnect(code, reason), 2500);
      }
    } else {
      await this.manager.nodes.remove(this, `Node couldn't reconnect in ${this.tries} tries.`);
    }
  }
}
