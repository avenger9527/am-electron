import axios, { AxiosRequestConfig } from 'axios';
import * as randomUseragent from 'random-useragent';
import * as tunnel from 'tunnel';
const pcFilter = (os: any) => os.osName === 'Windows' && os.osVersion === '10';
const tunnelingAgent = tunnel.httpsOverHttp({
  proxy: {
    host: '127.0.0.1',
    port: 1088,
  },
});
export const createAxios = ({ isNeedProxy = true } = {}) => {
  const defaultOptions: AxiosRequestConfig = {
    timeout: 5000,
    headers: {
      'User-Agent': randomUseragent.getRandom(pcFilter),
    },
  };
  if (isNeedProxy) {
    defaultOptions.proxy = false;
    defaultOptions.httpsAgent = tunnelingAgent;
  }
  return axios.create(defaultOptions);
};

export class PromiseLimit {
  result: any[];
  onList: any[];
  waitList: any[];
  limitCount: number;
  onFinished: (res: any) => void;
  constructor(limitCount: number, onFinished: () => void) {
    this.result = [];
    this.limitCount = limitCount;
    this.onFinished = onFinished;
    this.onList = [];
    this.waitList = [];
  }
  async run(fn: any) {
    // console.log(`waitList个数`, this.waitList.length);
    if (this.onList.length < this.limitCount) {
      this.onList.push(fn);
      fn()
        .then((r: any) => {
          this.result.push(r);
          this.onList.shift();
          if (this.waitList.length) this.run(this.waitList.shift());
        })
        .finally(() => {
          setTimeout(() => {
            if (this.onList.length === 0 && this.waitList.length === 0) {
              this.onFinished(this.result);
            }
          }, 0);
        });
    } else {
      this.waitList.push(fn);
    }
  }
  waitListCount() {
    return this.waitList.length;
  }
}

export const createTimeTag = () => Date().slice(16, 24).replace(/:/g, '-');
