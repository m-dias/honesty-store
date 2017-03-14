import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router';
import Chrome from '../layout/chrome';
import List from '../chrome/list';
import StoreItem from './item';
import MiscSelection from '../item/misc-selection';
import isRegistedUser from '../reducers/is-registered-user';
import Balance from '../topup/balance';
import { performGoHome } from '../actions/gohome';

const GoHome = ({ performGoHome }) =>
  <Link className="btn" onClick={performGoHome}>Home</Link>;

const SignIn = () =>
  <Link className="btn" to="/register">Sign In</Link>;

const itemRenderer = (item, index) => <StoreItem item={item} />;

const Store = ({ registered, storeCode, balance, items, surveyAvailable, performGoHome }) =>
  <Chrome title={storeCode || 'Store'}
    left={!registered && <GoHome performGoHome={performGoHome} />}
    right={registered ? <Balance balance={balance} /> : <SignIn />}
    nav={registered}>
    {
      surveyAvailable &&
      <div className="border-gray border-bottom bg-white mb2">
        <Link to={`/survey`} className="btn regular flex items-center justify-between navy">
          <div>
            <h3>
              Think we're missing something?
            </h3>
            <p className="aqua">Tap here to take a quick survey</p>
          </div>
          <div className="" style={{ width: '5rem' }}>
            <MiscSelection />
          </div>
        </Link>
      </div>
    }
    <List data={items} itemRenderer={itemRenderer} />
  </Chrome>;

const storeOrdering = (items) => {
  const inStock = items.filter(item => item.count > 0);
  const depleted = items.filter(item => item.count === 0);

  return [
    ...inStock,
    ...depleted
  ];
};

const mapStateToProps = ({ user, store: { code, items }, survey }) => ({
  registered: isRegistedUser(user),
  storeCode: code,
  balance: user.balance || 0,
  items: storeOrdering(items),
  surveyAvailable: survey != null
});

export default connect(mapStateToProps, { performGoHome })(Store);
