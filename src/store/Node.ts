import {Collection} from "discord.js";
import {Node} from "../api/Node";
import {Manager} from "../Manager";
import {NodeOptions, NodeStatus} from "../interfaces/Node";

export class NodeStore extends Collection<string, Node> {
  public constructor(public readonly manager: Manager) {
    super();
  }

  static get [Symbol.species](): typeof Map {
    return <any>Collection;
  }

  /**
   * A collection of ideal nodes.
   */
  public get ideal(): Collection<string, Node> {
    const available = this.filter(node => node.connected);
    return available.sort((a, b) => a.penalties - b.penalties);
  }

  public get(key?: string): Node {
    return <Node>(key ? super.get(key) : this.ideal.first());
  }

  /**
   * Creates a node.
   * @param options
   */
  public create(options: NodeOptions): Node {
    const node = new Node(this.manager, options);
    this.set(node.name, node);
    return node;
  }

  /**
   * Creates many nodes.
   * @param data
   */
  public createMany(...data: NodeOptions[]): void {
    for (const node of data)
      this.create(node);
  }

  /**
   * Removes a node, and moves all the existing players assigned to it.
   * @param node
   * @param reason
   */
  public async remove(node: Node, reason: string): Promise<void> {
    if (node.state === NodeStatus.DISCONNECTED) return;
    try {
      this.delete(node.name);

      for (const player of node.players.values()) node.players.move(player, this.get() || this.random());

      if (node["ws"]) {
        node["ws"].removeAllListeners();
        await node["ws"].close(4011, 'disconnecting node');
      }

      this.manager.emit("disconnected", node.name, reason);
      node.state = NodeStatus.DISCONNECTED;
    } catch (e) {
      this.manager.emit("error", node.name, e);
    }
  }
}