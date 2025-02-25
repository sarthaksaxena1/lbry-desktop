// @flow
import { BITWAVE_EMBED_URL } from 'constants/livestream';
import React from 'react';
import FileTitleSection from 'component/fileTitleSection';
import LivestreamComments from 'component/livestreamComments';

type Props = {
  uri: string,
  claim: ?StreamClaim,
  isLive: boolean,
  activeViewers: number,
};

export default function LivestreamLayout(props: Props) {
  const { claim, uri, isLive, activeViewers } = props;

  if (!claim || !claim.signing_channel) {
    return null;
  }

  const channelName = claim.signing_channel.name;
  const channelClaimId = claim.signing_channel.claim_id;

  return (
    <>
      <div className="section card-stack">
        <div className="file-render file-render--video livestream">
          <div className="file-viewer">
            <iframe
              src={`${BITWAVE_EMBED_URL}/${channelClaimId}?skin=odysee&autoplay=1`}
              scrolling="no"
              allowFullScreen
            />
          </div>
        </div>

        {!isLive && (
          <div className="help--notice">
            {__("%channel% isn't live right now, but the chat is! Check back later to watch the stream.", {
              channel: channelName || __('This channel'),
            })}
          </div>
        )}
        <FileTitleSection
          uri={uri}
          livestream
          isLive={isLive}
          activeViewers={activeViewers}
          stateOfViewers={isLive ? __('watching') : __('waiting')}
        />
      </div>
      <LivestreamComments uri={uri} />
    </>
  );
}
