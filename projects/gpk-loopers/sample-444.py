import json, random, time, urllib.request

KEY = json.load(open('/home/hatch/.opensea/key.json'))['api_key']
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
C = "0x1649CD37f4748807b4882FC48765bA0B2aFfa94a"

random.seed(20260927)
ids = [667] + random.sample([i for i in range(1, 7778) if i != 667], 443)

out = []
for n, tid in enumerate(ids):
    url = f"https://api.opensea.io/api/v2/chain/base/contract/{C}/nfts/{tid}"
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"X-API-KEY": KEY, "User-Agent": UA})
            d = json.load(urllib.request.urlopen(req, timeout=20))
            nft = d.get("nft", {})
            traits = {t["trait_type"]: t["value"] for t in nft.get("traits", [])}
            out.append({"token_id": tid, "name": nft.get("name"), "traits": traits,
                        "image": nft.get("image_url")})
            break
        except Exception as e:
            wait = 2 ** attempt
            print(f"retry {tid} in {wait}s ({e})", flush=True)
            time.sleep(wait)
    else:
        print(f"FAILED {tid}", flush=True)
    if (n + 1) % 50 == 0:
        print(f"{n+1}/444 done", flush=True)
    time.sleep(0.35)

json.dump(out, open("/home/hatch/workspace/gpk-loopers/looper-sample-444.json", "w"), indent=1)
print(f"SAVED {len(out)}/444")
