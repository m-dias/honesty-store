import React from 'react';
import { connect } from 'react-redux';
import Card from '../chrome/card';
import { BackToPage } from '../chrome/link';
import Full from '../layout/full';
import { performTopup } from '../actions/topup';

const NewCard = ({ performTopup, ...rest }) => (
  <Full left={<BackToPage path="/store" title="Back" />}>
    <Card
      isInitialTopUp={false}
      confirmButtonText="Add New Card"
      onSubmit={({ cardDetails }) => performTopup({ cardDetails, amount: 0 })}
      {...rest}
    />
  </Full>
);

export default connect(() => ({}), { performTopup })(NewCard);
