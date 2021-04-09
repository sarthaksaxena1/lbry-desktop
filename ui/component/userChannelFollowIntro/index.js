import { connect } from 'react-redux';
import { selectFollowedTags } from 'redux/selectors/tags';
import { selectSubscriptions } from 'redux/selectors/subscriptions';
import { doChannelSubscribe } from 'redux/actions/subscriptions';
import UserChannelFollowIntro from './view';
import { makeSelectClientSetting, selectHomepageData } from 'redux/selectors/settings';
import { selectHasSyncedWallet, selectPrefsReady, selectSyncIsLocked } from 'redux/selectors/sync';
import { SETTINGS } from 'lbry-redux';

const select = (state) => ({
  followedTags: selectFollowedTags(state),
  subscribedChannels: selectSubscriptions(state),
  homepageData: selectHomepageData(state),
  prefsReady: selectPrefsReady(state),
  hasSyncedWallet: selectHasSyncedWallet(state),
  syncEnabled: makeSelectClientSetting(SETTINGS.ENABLE_SYNC)(state),
  syncIsLocked: selectSyncIsLocked(state),
});

const perform = (dispatch) => ({
  channelSubscribe: (uri) => dispatch(doChannelSubscribe(uri)),
});

export default connect(select, perform)(UserChannelFollowIntro);
