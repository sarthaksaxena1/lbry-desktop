// @flow
import * as ICONS from 'constants/icons';
import { BITWAVE_API } from 'constants/livestream';
import React from 'react';
import ClaimList from 'component/claimList';
import Icon from 'component/common/icon';
import Spinner from 'component/spinner';

const LIVESTREAM_POLL_IN_MS = 10 * 1000;

export default function LivestreamList() {
  const [loading, setLoading] = React.useState(true);
  const [livestreamMap, setLivestreamMap] = React.useState();
  const livestreamUris =
    livestreamMap &&
    Object.keys(livestreamMap).map((claimId) => {
      const livestream = livestreamMap[claimId];
      return `lbry://${livestream.claimData.name}#${livestream.claimId}`;
    });

  React.useEffect(() => {
    function checkCurrentLivestreams() {
      fetch(BITWAVE_API)
        .then((res) => res.json())
        .then((res) => {
          setLoading(false);
          if (!res.data) {
            setLivestreamMap({});
            return;
          }

          const livestreamMap = res.data.reduce((acc, curr) => {
            return {
              ...acc,
              [curr.claimId]: curr,
            };
          }, {});

          setLivestreamMap(livestreamMap);
        })
        .catch((err) => {
          setLoading(false);
        });
    }

    checkCurrentLivestreams();
    let fetchInterval = setInterval(checkCurrentLivestreams, LIVESTREAM_POLL_IN_MS);
    return () => {
      if (fetchInterval) {
        clearInterval(fetchInterval);
      }
    };
  }, []);

  return (
    <>
      {loading && (
        <div className="main--empty">
          <Spinner delayed />
        </div>
      )}

      {livestreamMap && Object.keys(livestreamMap).length > 0 && (
        <div className="claim-grid__wrapper">
          <h1 className="claim-grid__header">
            <Icon className="claim-grid__header-icon" sectionIcon icon={ICONS.LIVESTREAM_SOLID} size={26} />
            <span className="claim-grid__title">{__('Currently Live')}</span>
          </h1>
          <ClaimList
            tileLayout
            title={__('Currently Live')}
            renderProperties={(claim) => {
              const livestream = livestreamMap[claim.claim_id];
              return (
                <span>
                  {livestream.viewCount} <Icon icon={ICONS.EYE} />
                </span>
              );
            }}
            uris={livestreamUris}
          />
        </div>
      )}
    </>
  );
}
