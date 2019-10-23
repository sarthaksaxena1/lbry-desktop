import { connect } from 'react-redux';
import {
  doResolveUri,
  makeSelectClaimIsPending,
  makeSelectClaimForUri,
  makeSelectThumbnailForUri,
  makeSelectIsUriResolving,
  selectChannelIsBlocked,
} from 'lbry-redux';

import Comment from './view';

const select = (state, props) => ({
  pending: props.authorUri && makeSelectClaimIsPending(props.authorUri)(state),
  claim: props.authorUri && makeSelectClaimForUri(props.authorUri)(state),
  isResolvingUri: props.authorUri && makeSelectIsUriResolving(props.authorUri)(state),
  thumbnail: props.authorUri && makeSelectThumbnailForUri(props.authorUri)(state),
  channelIsBlocked: props.authorUri && selectChannelIsBlocked(props.authorUri)(state),
});

const perform = dispatch => ({
  resolveUri: uri => dispatch(doResolveUri(uri)),
});

export default connect(
  select,
  perform
)(Comment);
