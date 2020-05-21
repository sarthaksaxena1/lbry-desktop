// @flow
import React, { useEffect } from 'react';
import Button from 'component/button';
import FileViewerEmbeddedTitle from 'component/fileViewerEmbeddedTitle';
import { useHistory } from 'react-router-dom';
import useIsMobile from 'effects/use-is-mobile';
import { formatLbryUrlForWeb } from 'util/url';

type Props = {
  uri: string,
  thumbnail: string,
  claim: ?Claim,
  doResolveUri: string => void,
  doFetchCostInfoForUri: string => void,
  doSetFloatingUri: string => void,
  floatingPlayerEnabled: boolean,
  doPlayUri: (string, ?boolean, ?boolean, (GetResponse) => void) => void,
  doAnaltyicsPurchaseEvent: GetResponse => void,
  fileInfo: FileListItem,
};

export default function FileRenderFloating(props: Props) {
  const {
    uri,
    thumbnail = '',
    claim,
    doResolveUri,
    doFetchCostInfoForUri,
    doSetFloatingUri,
    floatingPlayerEnabled,
    doPlayUri,
    doAnaltyicsPurchaseEvent,
    fileInfo,
  } = props;
  const { push } = useHistory();
  const isMobile = useIsMobile();
  const hasResolvedUri = claim !== undefined;

  useEffect(() => {
    doResolveUri(uri);
    doFetchCostInfoForUri(uri);
  }, [uri, doResolveUri, doFetchCostInfoForUri]);

  function handleClick() {
    if (!hasResolvedUri) {
      return;
    }

    if (isMobile || !floatingPlayerEnabled) {
      const formattedUrl = formatLbryUrlForWeb(uri);
      push(formattedUrl);
    } else {
      doPlayUri(uri, undefined, undefined, fileInfo => {
        doSetFloatingUri(uri);
        doAnaltyicsPurchaseEvent(fileInfo);
      });
    }
  }

  return (
    <div
      disabled={!hasResolvedUri}
      role="button"
      className="embed__inline-button"
      onClick={handleClick}
      style={{ backgroundImage: `url('${thumbnail.replace(/'/g, "\\'")}')` }}
    >
      <FileViewerEmbeddedTitle uri={uri} isInApp />
      <Button onClick={handleClick} iconSize={30} title={__('Play')} className={'button--icon button--play'} />
    </div>
  );
}
