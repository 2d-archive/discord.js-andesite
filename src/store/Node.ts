import {Collection} from "discord.js";
import {Node} from "../api/Node";
import {Manager} from "../Manager";
import {NodeOptions, NodeStatus} from "../interfaces/Node";

export class NodeStore extends Collection<string, Node> {
  public constructor(
    public readonly manager: Manager
  ) {
    super();
  }

  static get [Symbol.species]() {
    return <any>Collection;
  }

  public get ideal(): Collection<string, Node> {
    return this.filter(node => {
      if (node.connected) node.getStats();
      return node.connected;
    }).sort((a, b) => {
      const a_load = a.stats!.cpu ? a.stats!.cpu.system / a.stats!.os.processors * 100 : 0;
      const b_load = b.stats!.cpu ? b.stats!.cpu.system / b.stats!.os.processors * 100 : 0;
      return a_load - b_load;
    });
  }

  public get(key?: string) {
    return key ? super.get(key) : this.ideal.first();
  }

  public create(options: NodeOptions) {
    const node = new Node(this.manager, options);
    this.set(node.name, node);
    return node;
  }

  public createMany(...data: NodeOptions[]): void {
    for (const node of data)
      this.create(node);
  }

  public async remove(node: Node, reason: string) {
    if (node.state === NodeStatus.DISCONNECTED) return;
    try {
      this.delete(node.name);

      for (const player of node.players.values()) await node.players.move(player, this.get() || this.random());
      node.removeAllListeners();

      if (node["ws"]) {
        node["ws"].removeAllListeners();
        await node["ws"].close(4011, 'disconnecting node');
      }

      this.manager.emit("disconnected", node.name, reason);
    } catch (e) {
      this.manager.emit("error", node.name, e);
    }
  }
}