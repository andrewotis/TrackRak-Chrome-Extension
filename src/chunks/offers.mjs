// src/chunks/offers.mjs
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function fetchAllInStoreOffers() {
  const base_endpoint = 'https://www.rakuten.com/feedapi/v1/regions/USA/topic';
  let topicId = 43461;
  let sort = 'alphabetical';
  let cursor = '';
  let hasNextPage = true;
  let offers = [];

  while (hasNextPage) {
    try {
      const q = `${base_endpoint}?topicId=${topicId}&sort=${sort}&cursor=${cursor}`;
      const response = await fetch(q, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Platform': 'DESKTOP_WEB' }
      });
      const data = await response.json();
      const temp_offers = data?.data?.viewer?.topic?.items?.edges || [];
      const page_info = data?.data?.viewer?.topic?.items?.pageInfo || { hasNextPage: false, endCursor: '' };

      temp_offers.forEach(offer => {
        if (offer?.node?.itemData) offers.push(offer.node.itemData);
      });

      hasNextPage = page_info.hasNextPage;
      cursor = page_info.endCursor;
      await delay(250);
    } catch (error) {
      console.error('Error fetching in-store offers:', error);
      hasNextPage = false;
    }
  }

  return offers;
}

async function activateOffer(offer, eb, rakutenUserId) {
  const base_url = 'https://rrcloapi.rrcbsn.com/offers_linker/v1/link-all-cards-to-offers';
  const offer_id = parseInt(offer.id, 10);
  const payload = JSON.stringify({
    userGUID: rakutenUserId,
    offerIds: [offer_id],
    trackingTicket: { sourceName: 'Web-Desktop', sourceId: 6991168 }
  });

  try {
    const resp = await fetch(base_url, {
      method: 'POST',
      headers: { Ebtoken: eb, 'content-type': 'application/json' },
      body: payload
    });

    try {
      const json = await resp.json();
      return { ok: true, json, status: resp.status };
    } catch (err) {
      return { ok: true, json: null, status: resp.status };
    }
  } catch (err) {
    console.error('activateOffer error for', offer_id, err);
    return { ok: false, error: err };
  }
}

export async function activateAllInStoreOffers(unactivated_offers, eb, rakutenUserId, progressCallback) {
  if (!Array.isArray(unactivated_offers)) unactivated_offers = [];
  const total = unactivated_offers.length;
  let done = 0;
  if (total === 0) return { done: 0, total: 0 };

  for (let i = 0; i < unactivated_offers.length; i++) {
    const offer = unactivated_offers[i];
    const name = offer.merchantname_text || offer.merchantname || `offer-${offer.id}`;

    const res = await activateOffer(offer, eb, rakutenUserId);

    if (i === 0) {
      const json = res && res.json;
      if (json && json.status === 'No-Cards') {
        return { done, total, noCards: true };
      }
    }

    done++;
    if (typeof progressCallback === 'function') {
      progressCallback({ done, total, currentOfferName: name });
    }
    await delay(100);
  }

  try { localStorage.setItem('TrackRakLastActivated', new Date().toISOString()); } catch (e) {}
  return { done, total };
}