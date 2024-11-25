function defaultFetchErrorFactory(response: Response, json: any) {
  return new Error(`Fetch error: endpoint responded with status ${response.status}.${
    (json!==null && json!==undefined) ? ' Received the following data: '+JSON.stringify(json) : null}`);
}

class _BetterFetch {
  config: {
    maxParallelRequests: number, 
    postLimitDelay: number
  }
  private nRequests;
  private maximumRequestsResolves: (()=>void)[];

  constructor(maxParallelRequests = 10, postLimitDelay = 250) {
    if (maxParallelRequests <= 0) throw new Error('The maximum number of parallel requests has to be positive.');
    this.config = {
      maxParallelRequests, 
      postLimitDelay
    }
    this.nRequests = 0;
    this.maximumRequestsResolves = [];
  }
  
  private fetchWithLimitHandling(url: string, onFetchStart: ()=>void): ReturnType<typeof fetch> {
    if (this.nRequests >= this.config.maxParallelRequests) {
      const maximumRequestsPromise = new Promise<void>(resolve=>{
        this.maximumRequestsResolves.push(resolve);
      }).then(()=>new Promise<void>(resolve=>setTimeout(resolve, this.config.postLimitDelay))); 
      return maximumRequestsPromise.then(()=>this.fetchWithLimitHandling(url, onFetchStart));
    }
    this.nRequests+=1;
    onFetchStart();
    return fetch(url);
  }
  
  betterFetch(endpointURL: string, onFetchStart: ()=>void, 
    fetchErrorFactory = defaultFetchErrorFactory 
  ) {
    return this.fetchWithLimitHandling(endpointURL, onFetchStart).finally(()=>{
      this.nRequests-=1;
      const resolve = this.maximumRequestsResolves.shift();
      if (resolve && this.nRequests < this.config.maxParallelRequests) {
        resolve();
      }
    })
      .then(response=> {
        return response.json().then((response.ok) ? responseJSON=>responseJSON : 
          responseJSON => {
            throw fetchErrorFactory(response, responseJSON);
          }
        )
      });
  }
}

export function BetterFetch(maxParallelRequests=10, postLimitDelay=250) {
  const newFetchManager = new _BetterFetch(maxParallelRequests, postLimitDelay);
  return { 
    betterFetch: newFetchManager.betterFetch.bind(newFetchManager), 
    config: newFetchManager.config
  }
}