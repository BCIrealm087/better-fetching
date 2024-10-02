function defaultFetchErrorFactory(response: Response, json: any) {
  return new Error(`Fetch error: endpoint responded with status ${response.status}.${
    (json!==null && json!==undefined) ? ' Received the following data: '+JSON.stringify(json) : null}`);
}

class _BetterFetch {
  config: {
    maxParallelRequests: number
  }
  private nRequests;
  private maximumRequestsPromise: Promise<void>|null;
  private maximumRequestsResolve: (()=>void)|null;

  constructor(maxParallelRequests = 10) {
    this.config = {
      maxParallelRequests: maxParallelRequests
    }
    this.nRequests = 0;
    this.maximumRequestsResolve = this.maximumRequestsPromise = null;
  }
  
  private fetchWithLimitHandling(url: string, onFetchStart: ()=>void): ReturnType<typeof fetch> {
    if (this.nRequests > this.config.maxParallelRequests) {
      if (!this.maximumRequestsPromise) {
        this.maximumRequestsPromise = new Promise<void>(resolve=>{
          this.maximumRequestsResolve = resolve;
        });
      }
      return this.maximumRequestsPromise.then(()=>this.fetchWithLimitHandling(url, onFetchStart));
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
      if (this.maximumRequestsResolve && this.nRequests <= this.config.maxParallelRequests) {
        this.maximumRequestsResolve();
        this.maximumRequestsPromise = this.maximumRequestsResolve = null;
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

export function BetterFetch(maxParallelRequests=10) {
  const newFetchManager = new _BetterFetch(maxParallelRequests);
  return { 
    betterFetch: newFetchManager.betterFetch.bind(newFetchManager), 
    config: newFetchManager.config
  }
}