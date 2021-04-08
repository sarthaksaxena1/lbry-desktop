// @flow
import React from 'react';
import Button from 'component/button';
import { FormField, Form } from 'component/common/form';
import { Lbryio } from 'lbryinc';
import Card from 'component/common/card';
import LbcSymbol from 'component/common/lbc-symbol';
import Spinner from 'component/spinner';
import Nag from 'component/common/nag';
import CopyableText from 'component/copyableText';
import QRCode from 'component/common/qr-code';
import usePersistedState from 'effects/use-persisted-state';
import * as ICONS from 'constants/icons';
import * as MODALS from 'constants/modal_types';
import * as PAGES from 'constants/pages';
import { clipboard } from 'electron';
import I18nMessage from 'component/i18nMessage';
import { Redirect, useHistory } from 'react-router';

const BTC_SATOSHIS = 100000000;
const BTC_MAX = 21000000;
const BTC_MIN = 1 / BTC_SATOSHIS;

const IS_DEV = process.env.NODE_ENV !== 'production';
const DEBOUNCE_BTC_CHANGE_MS = 400;

const INTERNAL_APIS_DOWN = 'internal_apis_down';
const BTC_API_STATUS_PENDING = 'NEW'; // Started swap, waiting for coin.
const BTC_API_STATUS_CONFIRMING = 'PENDING'; // Coin receiving, waiting confirmation.
const BTC_API_STATUS_PROCESSING = 'COMPLETED'; // Coin confirmed. Sending LBC.
const BTC_API_STATUS_EXPIRED = 'EXPIRED'; // Charge expired (60 minutes).
const BTC_API_STATUS_ERROR = 'Error';

const ACTION_MAIN = 'action_main';
const ACTION_STATUS_PENDING = 'action_pending';
const ACTION_STATUS_CONFIRMING = 'action_confirming';
const ACTION_STATUS_PROCESSING = 'action_processing';
const ACTION_STATUS_SUCCESS = 'action_success';
const ACTION_PAST_SWAPS = 'action_past_swaps';

const NAG_API_STATUS_PENDING = 'Waiting to receive your crypto.';
const NAG_API_STATUS_CONFIRMING = 'Confirming transaction.';
const NAG_API_STATUS_PROCESSING = 'Bitcoin received. Sending your LBC.';
const NAG_API_STATUS_SUCCESS = 'LBC sent. You should see it in your wallet.';
const NAG_API_STATUS_ERROR = 'An error occurred on the previous swap.';
const NAG_SWAP_CALL_FAILED = 'Failed to initiate swap.';
// const NAG_STATUS_CALL_FAILED = 'Failed to query swap status.';
const NAG_SERVER_DOWN = 'The system is currently down. Come back later.';
const NAG_RATE_CALL_FAILED = 'Unable to obtain exchange rate. Try again later.';
const NAG_EXPIRED = 'Swap expired.';

type Props = {
  receiveAddress: string,
  coinSwaps: Array<CoinSwapInfo>,
  isAuthenticated: boolean,
  doToast: ({ message: string }) => void,
  addCoinSwap: (CoinSwapInfo) => void,
  getNewAddress: () => void,
  checkAddressIsMine: (string) => void,
  openModal: (string, {}) => void,
  queryCoinSwapStatus: (string) => void,
};

function WalletSwap(props: Props) {
  const {
    receiveAddress,
    doToast,
    coinSwaps,
    isAuthenticated,
    addCoinSwap,
    getNewAddress,
    checkAddressIsMine,
    openModal,
    queryCoinSwapStatus,
  } = props;

  const [btc, setBtc] = usePersistedState('swap-btc-amount', 0.001);
  const [btcError, setBtcError] = React.useState();
  const [lbc, setLbc] = React.useState(0);
  const [action, setAction] = React.useState(ACTION_MAIN);
  const [nag, setNag] = React.useState(null);
  const [showQr, setShowQr] = React.useState(false);
  const [isFetchingRate, setIsFetchingRate] = React.useState(false);
  const [isSwapping, setIsSwapping] = React.useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = React.useState(false);
  const { location } = useHistory();
  const [swap, setSwap] = React.useState({});
  const [coin, setCoin] = React.useState('bitcoin');
  const [lastStatusQuery, setLastStatusQuery] = React.useState();

  const sendTxId = swap && swap.status ? swap.status.receipt_txid : null;
  const lbcTxId = swap && swap.status ? swap.status.lbc_txid : null;

  function formatLbcString(lbc) {
    return lbc === 0 ? '---' : lbc.toLocaleString(undefined, { minimumFractionDigits: 8 });
  }

  function returnToMainAction() {
    setIsSwapping(false);
    setAction(ACTION_MAIN);
    setSwap(null);
  }

  function removeCoinSwap(chargeCode) {
    openModal(MODALS.CONFIRM_REMOVE_BTC_SWAP_ADDRESS, {
      chargeCode: chargeCode,
    });
  }

  // Ensure 'receiveAddress' is populated
  React.useEffect(() => {
    if (!receiveAddress) {
      getNewAddress();
    } else {
      checkAddressIsMine(receiveAddress);
    }
  }, [receiveAddress, getNewAddress, checkAddressIsMine]);

  // Get 'btc/rate'
  React.useEffect(() => {
    if (isNaN(btc) || btc === 0) {
      setLbc(0);
      return;
    }

    setIsFetchingRate(true);

    const timer = setTimeout(() => {
      Lbryio.call('btc', 'rate', { satoshi: BTC_SATOSHIS })
        .then((result) => {
          setIsFetchingRate(false);
          setLbc(btc / result);
        })
        .catch(() => {
          setIsFetchingRate(false);
          setLbc(0);
          setNag({ msg: NAG_RATE_CALL_FAILED, type: 'error' });
        });
    }, DEBOUNCE_BTC_CHANGE_MS);

    return () => clearTimeout(timer);
  }, [btc]);

  // Resolve status for current swap
  React.useEffect(() => {
    const swapInfo = swap && coinSwaps.find((x) => x.chargeCode === swap.chargeCode);
    if (!swapInfo || !swapInfo.status) {
      return;
    }

    switch (swapInfo.status.status) {
      case BTC_API_STATUS_PENDING:
        setAction(ACTION_STATUS_PENDING);
        setNag({ msg: NAG_API_STATUS_PENDING, type: 'helpful' });
        break;
      case BTC_API_STATUS_CONFIRMING:
        setAction(ACTION_STATUS_CONFIRMING);
        setNag({ msg: NAG_API_STATUS_CONFIRMING, type: 'helpful' });
        break;
      case BTC_API_STATUS_PROCESSING:
        if (swapInfo.status.lbc_txid) {
          setAction(ACTION_STATUS_SUCCESS);
          setNag({ msg: NAG_API_STATUS_SUCCESS, type: 'helpful' });
          setIsSwapping(false);
        } else {
          setAction(ACTION_STATUS_PROCESSING);
          setNag({ msg: NAG_API_STATUS_PROCESSING, type: 'helpful' });
        }
        break;
      case BTC_API_STATUS_ERROR:
        setNag({ msg: NAG_API_STATUS_ERROR, type: 'error' });
        returnToMainAction();
        break;
      case INTERNAL_APIS_DOWN:
        setNag({ msg: NAG_SERVER_DOWN, type: 'error' });
        returnToMainAction();
        break;
      case BTC_API_STATUS_EXPIRED:
        setNag({ msg: NAG_EXPIRED, type: 'error' });
        break;
      default:
        setNag({ msg: swapInfo.status.status, type: 'error' });
        break;
    }
  }, [swap, coinSwaps]);

  // Validate entered BTC
  React.useEffect(() => {
    let msg;
    if (btc < BTC_MIN) {
      msg = __('The BTC amount needs to be higher');
    } else if (btc > BTC_MAX) {
      msg = __('The BTC amount is too high');
    }
    setBtcError(msg);
  }, [btc]);

  // 'Refresh' button feedback
  React.useEffect(() => {
    let timer;
    if (isRefreshingStatus) {
      timer = setTimeout(() => {
        setIsRefreshingStatus(false);
      }, 1000);
    }

    return () => clearTimeout(timer);
  }, [isRefreshingStatus]);

  function getCoinAddress(coin) {
    if (swap && swap.sendAddresses) {
      return swap.sendAddresses[coin];
    }
    return '';
  }

  function getCoinSendAmountStr(coin) {
    if (swap && swap.sendAmounts) {
      return `${swap.sendAmounts[coin].amount} ${swap.sendAmounts[coin].currency}`;
    }
    return '';
  }

  function getCoinLabel(coin) {
    const COIN_LABEL = {
      dai: 'Dai',
      usdc: 'USD Coin',
      bitcoin: 'Bitcoin',
      ethereum: 'Ethereum',
      litecoin: 'Litecoin',
      bitcoincash: 'Bitcoin Cash',
    };

    return COIN_LABEL[coin] || coin;
  }

  function getLbcAmountStrForSwap(swap) {
    if (swap && swap.lbcAmount) {
      return formatLbcString(swap.lbcAmount);
    }
    return '---';
  }

  function handleStartSwap() {
    setIsSwapping(true);
    setSwap(null);
    setNag(null);

    Lbryio.call('btc', 'swap', {
      lbc_satoshi_requested: parseInt(lbc * BTC_SATOSHIS),
      btc_satoshi_provided: parseInt(btc * BTC_SATOSHIS),
      pay_to_wallet_address: receiveAddress,
    })
      .then((response) => {
        const swap = {
          chargeCode: response.Exchange.charge_code,
          coins: Object.keys(response.Charge.data.addresses),
          sendAddresses: response.Charge.data.addresses,
          sendAmounts: response.Charge.data.pricing,
          lbcAmount: lbc,
        };

        setSwap({ ...swap });
        addCoinSwap({ ...swap });
      })
      .catch((err) => {
        setNag({ msg: err === INTERNAL_APIS_DOWN ? NAG_SWAP_CALL_FAILED : err.message, type: 'error' });
        returnToMainAction();
      });
  }

  function handleCancelPending() {
    returnToMainAction();
    setNag(null);
  }

  function handleBtcChange(event: SyntheticInputEvent<*>) {
    const btc = parseFloat(event.target.value);
    setBtc(btc);
  }

  function handleViewPastSwaps() {
    setAction(ACTION_PAST_SWAPS);
    setNag(null);
    setIsRefreshingStatus(true);

    const now = Date.now();
    if (!lastStatusQuery || now - lastStatusQuery > 60000) {
      // There is a '200/minute' limit in the commerce API. If the history is
      // long, or if the user goes trigger-happy, the limit could be reached
      // easily. Statuses don't change often, so just limit it to every minute.
      setLastStatusQuery(now);
      coinSwaps.forEach((x) => {
        queryCoinSwapStatus(x.chargeCode);
      });
    }
  }

  function getShortStatusStr(coinSwap: CoinSwapInfo) {
    const swapInfo = coinSwaps.find((x) => x.chargeCode === coinSwap.chargeCode);
    if (!swapInfo || !swapInfo.status) {
      return '---';
    }

    let msg;
    switch (swapInfo.status.status) {
      case BTC_API_STATUS_PENDING:
        msg = __('Waiting');
        break;
      case BTC_API_STATUS_CONFIRMING:
        msg = __('Confirming');
        break;
      case BTC_API_STATUS_PROCESSING:
        if (swapInfo.status.lbc_txid) {
          msg = __('Credits sent');
        } else {
          msg = __('Sending Credits');
        }
        break;
      case BTC_API_STATUS_ERROR:
        msg = __('Failed');
        break;
      case BTC_API_STATUS_EXPIRED:
        msg = __('Expired');
        break;
      default:
        msg = swapInfo.status.status;
        // if (IS_DEV) throw new Error('Unhandled "status": ' + status.Status);
        break;
    }
    return msg;
  }

  function getViewTransactionElement(isSend) {
    if (isSend) {
      return sendTxId ? (
        <Button
          button="link"
          label={sendTxId.substring(0, 7)}
          title={sendTxId}
          onClick={() => {
            clipboard.writeText(sendTxId);
            doToast({
              message: __('Transaction ID copied.'),
            });
          }}
        />
      ) : null;
    } else {
      return lbcTxId ? (
        <Button button="link" href={`https://explorer.lbry.com/tx/${lbcTxId}`} label={__('View transaction')} />
      ) : null;
    }
  }

  function getActionElement() {
    switch (action) {
      case ACTION_MAIN:
        return actionMain;

      case ACTION_STATUS_PENDING:
        return actionPending;

      case ACTION_STATUS_CONFIRMING:
        return actionConfirmingSend;

      case ACTION_STATUS_PROCESSING: // fall-through
      case ACTION_STATUS_SUCCESS:
        return actionProcessingAndSuccess;

      case ACTION_PAST_SWAPS:
        return actionPastSwaps;

      default:
        if (IS_DEV) throw new Error('Unhandled action: ' + action);
        return actionMain;
    }
  }

  const actionMain = (
    <>
      <div className="section section--padded card--inline confirm__wrapper">
        <div className="section">
          <FormField
            autoFocus
            label={__('Bitcoin')}
            type="number"
            name="btc"
            className="form-field--price-amount--auto"
            affixClass="form-field--fix-no-height"
            max={BTC_MAX}
            min={BTC_MIN}
            step={1 / BTC_SATOSHIS}
            placeholder="12.34"
            value={btc}
            error={btcError}
            disabled={isSwapping}
            onChange={(event) => handleBtcChange(event)}
          />
          <div className="confirm__value" />
          <div className="confirm__label">{__('Credits')}</div>
          <div className="confirm__value">
            <LbcSymbol postfix={formatLbcString(lbc)} size={22} />
            {isFetchingRate && <Spinner type="small" />}
          </div>
        </div>
      </div>
      <div className="section__actions">
        <Button
          autoFocus
          onClick={handleStartSwap}
          button="primary"
          disabled={isSwapping || isNaN(btc) || btc === 0 || lbc === 0 || btcError}
          label={isSwapping ? __('Processing...') : __('Start Swap')}
        />
        {coinSwaps.length !== 0 && <Button button="link" label={__('View Past Swaps')} onClick={handleViewPastSwaps} />}
      </div>
    </>
  );

  const actionPending = (
    <>
      <div className="section section--padded card--inline confirm__wrapper">
        <div className="section">
          {swap && swap.coins && (
            <div className="confirm__value">
              <FormField
                type="select"
                name="select_coin"
                value={coin}
                label={__('Alternative coins')}
                onChange={(e) => setCoin(e.target.value)}
              >
                {swap.coins.map((x) => (
                  <option key={x} value={x}>
                    {getCoinLabel(x)}
                  </option>
                ))}
              </FormField>
            </div>
          )}
          <div className="confirm__label">{__('Send')}</div>
          <div className="confirm__value">{getCoinSendAmountStr(coin)}</div>
          <div className="confirm__label">{__('To')}</div>
          <CopyableText primaryButton copyable={getCoinAddress(coin)} snackMessage={__('Address copied.')} />
          <div className="card__actions--inline">
            <Button
              button="link"
              label={showQr ? __('Hide QR code') : __('Show QR code')}
              onClick={() => setShowQr(!showQr)}
            />
            {showQr && getCoinAddress(coin) && <QRCode value={getCoinAddress(coin)} />}
          </div>
          <div className="confirm__value" />
          <div className="confirm__label">{__('Receive')}</div>
          <div className="confirm__value">{<LbcSymbol postfix={getLbcAmountStrForSwap(swap)} size={22} />}</div>
        </div>
      </div>
      <div className="section__actions">
        <Button autoFocus onClick={handleCancelPending} button="primary" label={__('Go Back')} />
      </div>
    </>
  );

  const actionConfirmingSend = (
    <>
      <div className="section section--padded card--inline confirm__wrapper">
        <div className="section">
          <div className="confirm__label">{__('Confirming')}</div>
          <div className="confirm__value">{getCoinSendAmountStr(coin)}</div>
          <div className="confirm__label">{getViewTransactionElement(true)}</div>
        </div>
      </div>
      <div className="section__actions">
        <Button autoFocus onClick={handleCancelPending} button="primary" label={__('Go Back')} />
      </div>
    </>
  );

  const actionProcessingAndSuccess = (
    <>
      <div className="section section--padded card--inline confirm__wrapper">
        <div className="section">
          <div className="confirm__label">{__('Sent')}</div>
          <div className="confirm__value">{getCoinSendAmountStr(coin)}</div>
          <div className="confirm__label">{getViewTransactionElement(true)}</div>
          <div className="confirm__value" />
          <div className="confirm__label">{action === ACTION_STATUS_SUCCESS ? __('Received') : __('Receiving')}</div>
          <div className="confirm__value">{<LbcSymbol postfix={getLbcAmountStrForSwap(swap)} size={22} />}</div>
          {action === ACTION_STATUS_SUCCESS && getViewTransactionElement(false)}
        </div>
      </div>
      <div className="section__actions">
        <Button autoFocus onClick={handleCancelPending} button="primary" label={__('Go Back')} />
      </div>
    </>
  );

  const actionPastSwaps = (
    <>
      <div className="section section--padded card--inline confirm__wrapper">
        <div className="section">
          <div className="table__wrapper">
            <table className="table table--btc-swap">
              <thead>
                <tr>
                  <th>{__('Code')}</th>
                  <th>{__('Status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {coinSwaps.length === 0 && (
                  <tr>
                    <td>{'---'}</td>
                  </tr>
                )}
                {coinSwaps.length !== 0 &&
                  coinSwaps.map((x) => {
                    return (
                      <tr key={x.chargeCode}>
                        <td>
                          <Button
                            button="link"
                            className="button--hash-id"
                            title={x.chargeCode}
                            label={x.chargeCode}
                            onClick={() => {
                              setSwap({ ...x });
                            }}
                          />
                        </td>
                        <td>{isRefreshingStatus ? '...' : getShortStatusStr(x)}</td>
                        <td>
                          <Button
                            button="link"
                            icon={ICONS.REMOVE}
                            title={__('Remove address')}
                            onClick={() => removeCoinSwap(x.chargeCode)}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="section__actions">
        <Button autoFocus onClick={handleCancelPending} button="primary" label={__('Go Back')} />
        {coinSwaps.length !== 0 && !isRefreshingStatus && (
          <Button button="link" label={__('Refresh')} onClick={handleViewPastSwaps} />
        )}
        {isRefreshingStatus && <Spinner type="small" />}
      </div>
    </>
  );

  if (!isAuthenticated) {
    return <Redirect to={`/$/${PAGES.AUTH_SIGNIN}?redirect=${location.pathname}`} />;
  }

  return (
    <Form onSubmit={handleStartSwap}>
      <Card
        title={<I18nMessage tokens={{ lbc: <LbcSymbol size={22} /> }}>Swap Crypto for %lbc%</I18nMessage>}
        subtitle={__('Send to the address provided and you will be sent an equivalent amount of Credits.')}
        actions={getActionElement()}
        nag={nag ? <Nag relative type={nag.type} message={__(nag.msg)} /> : null}
      />
    </Form>
  );
}

export default WalletSwap;
