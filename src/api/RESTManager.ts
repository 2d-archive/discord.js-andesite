import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from "axios";
import {Node} from "./Node";
import {EventEmitter} from "events";

export class RESTManager extends EventEmitter {

  public readonly url: string;
  public axios: AxiosInstance;

  public constructor(node: Node) {
    super();

    this.url = `http://${node.host}:${node.port}`;
    this.axios = axios.create({
      baseURL: this.url,
      headers: {'User-Id': node.manager.userId},
      timeout: node.manager.restTimeout || 10000
    });
    if (node["auth"]) this.axios.defaults.headers["Authorization"] = node["auth"];
  }

  public get(endpoint: string, config?: AxiosRequestConfig): Promise<any> {
    return new Promise((reso, reje) => {
      return this.axios.get(endpoint, config)
      .then((res: AxiosResponse) => {
        this.emit("GET", endpoint, config, res);
        return reso(res.data);
      })
      .catch(reje);
    });
  }

  public post(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
    return new Promise((reso, reje) => {
      return this.axios.post(endpoint, data, config)
      .then((res: AxiosResponse) => {
        this.emit("POST", endpoint, config, res);
        return reso(res.data);
      })
      .catch(reje);
    });
  }

  public patch(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
    return new Promise((reso, reje) => {
      return this.axios.patch(endpoint, data, config)
      .then((res: AxiosResponse) => {
        this.emit("PATCH", endpoint, config, res);
        return reso(res.data);
      })
      .catch(reje);
    });
  }

  public _delete(endpoint: string, config?: AxiosRequestConfig): Promise<any> {
    return new Promise((reso, reje) => {
      return this.axios.delete(endpoint, config)
      .then((res: AxiosResponse) => {
        this.emit("DELETE", endpoint, config, res);
        return reso(res.data);
      })
      .catch(reje);
    });
  }
}