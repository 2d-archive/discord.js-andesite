import {Client, Collection} from "discord.js";
import {EventEmitter} from "events";
import {NodeStore} from "./store/Node";
import {Player} from "./api/Player";
import {NodeOptions} from "./interfaces/Node";
import {Node} from "./api/Node";
import {LoadedTracks, TrackInfo} from "./interfaces/Entities";

export interface ManagerOptions {
  /**
   * The timeout for HTTP requests.
   * @default 10000
   */
  restTimeout?: number;
  /**
   * The number of tries to reconnect.
   * @default 3
   */
  reconnectTries?: number;
  /**
   * The nodes to connect to.
   */
  nodes: NodeOptions[];
  /**
   * The default volume for players.
   * @default 50
   */
  defaultVolume?: number
  /**
   * The player class to use.
   * @defaults Player*/
  player: typeof Player;
}

export interface VoiceServerUpdate {
  token: string;
  guild_id: string;
  endpoint: string;
}

export interface Packet {
  t: string;
  d: any;
  s: number;
}

export interface VoiceStateUpdate {
  channel_id?: string;
  guild_id: string;
  user_id: string;
  session_id: string;
  deaf?: boolean;
  mute?: boolean;
  self_deaf?: boolean;
  self_mute?: boolean;
  suppress?: boolean;
}

export class Manager extends EventEmitter {
  /**
   * The user id of the bot.
   */
  public userId!: string;
  /**
   * A collection of nodes.
   */
  public nodes: NodeStore = new NodeStore(this);
  /**
   * The timeout for rest actions.
   * @default 10000
   */
  public readonly restTimeout: number;
  /**
   * The default volume for players.
   * @default 50
   */
  public readonly defaultVolume: number;
  /**
   * How many tries to reconnect to the node.
   * @default 3
   */
  public readonly reconnectTries: number;
  /**
   * The player class to use.
   */
  public readonly player: typeof Player;

  /**
   * Creates a new Manager.
   * @param client The client used for receiving packets.
   * @param options Manager Options.
   */
  public constructor(
    public readonly client: Client,
    public readonly options: ManagerOptions
  ) {
    super();

    if (!options.nodes) throw new Error("Provide an array of nodes.");

    this.defaultVolume = options.defaultVolume || 50;
    this.restTimeout = options.restTimeout || 10000;
    this.reconnectTries = options.reconnectTries || 3;
    this.player = options.player || Player;

    client.on("raw", (pk: Packet) => {
      if (["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(pk.t)) {
        if (pk.t === "VOICE_STATE_UPDATE" && pk.d.user_id !== this.userId) return;
        if (this.players.has(pk.d.guild_id)) this.players.get(pk.d.guild_id)!["_voiceUpdate"](pk);
      }
    });
  }

  /**
   * A collection of players.
   */
  public get players(): Collection<string, Player> {
    const collection: Collection<string, Player> = new Collection();
    for (const node of this.nodes.values())
      for (const player of node.players.values())
        collection.set(player.guildId, player);
    return collection;
  }

  /**
   * Uses the /loadtracks endpoint, returns the response.
   * @param query The query for the identifier query parameter.
   * @param node This uses the rest property of a node.
   */
  public search(query: string, node?: Node): Promise<LoadedTracks> {
    if (!node && !this.nodes.get()) throw new Error(`No node available.`);
    return new Promise<LoadedTracks>((res, rej) => {
      return (<Node>node || this.nodes.get()).rest.get(`/loadtracks?identifier=${query}`)
      .then(res)
      .catch(rej);
    });
  }

  /**
   * Uses the /decodetracks endpoint, returns an array of track info
   * @param tracks An array of Base64 tracks.
   * @param node
   */
  public decode(tracks: string | string[], node: Node = this.nodes.get()): Promise<TrackInfo[]> {
    return new Promise((res, rej) => {
      if (!node) return rej(new Error(`No node available.`));
      return node.rest.post("/decodetracks", {tracks: Array.isArray(tracks) ? tracks : [tracks]})
      .then(res)
      .catch(rej);
    });
  }

  /**
   * Initializes this manager, and connects all the nodes.
   * @param userId The user id of the bot.
   */
  public init(userId: string) {
    if (!userId) throw new Error("you must provide a user id.");
    this.userId = userId;
    return this.nodes.createMany(...this.options.nodes);
  }
}