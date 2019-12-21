import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from "axios";
import {Node} from "./Node";
import {EventEmitter} from "events";

export class RESTManager extends EventEmitter {
  public readonly url: string;
  public axios: AxiosInstance;
  /**
   * The amount of requests for session (node connection, goes back to 0 on reconnect).
   */
  public requests: number = 0;
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

  /**
   * Makes a get request to the node.
   * @param endpoint The endpoint to make a request to.
   * @param config
   */
  public get(endpoint: string, config?: AxiosRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      return this.axios.get(endpoint, config)
      .then((res: AxiosResponse) => {
        this.requests++;
        return resolve(res.data)
      })
      .catch(reject);
    });
  }

  /**
   * Makes a POST request to the node
   * @param endpoint The endpoint to make a request to.
   * @param data The data to post.
   * @param config
   */
  public post(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      return this.axios.post(endpoint, data, config)
      .then((res: AxiosResponse) => {
        this.requests++;
        return resolve(res.data)
      })
      .catch(reject);
    });
  }

  /**
   * Makes a PATCH request to the node.
   * @param endpoint The endpoint to make a request to.
   * @param data The data to patch.
   * @param config
   */
  public patch(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      return this.axios.patch(endpoint, data, config)
      .then((res: AxiosResponse) => {
        this.requests++;
        return resolve(res.data)
      })
      .catch(reject);
    });
  }

  /**
   * Makes a DELETE request to the node.
   * @param endpoint The endpoint to make a request to.
   * @param config
   * @private
   */
  public delete(endpoint: string, config?: AxiosRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      return this.axios.delete(endpoint, config)
      .then((res: AxiosResponse) => {
        this.requests++;
        return resolve(res.data)
      })
      .catch(reject);
    });
  }
}