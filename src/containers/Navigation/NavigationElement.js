import React from 'react';
import { withRouter } from 'react-router-dom';

const NavigationElement = props => {
  const urlFormat = props.path !== undefined ? props.path : props.heading.toLowerCase().split(' ').join('-');

  return (
    <button className={`navigation-element${props.location.pathname === `/${urlFormat}` ? ' active' : ''}`} style={{cursor: 'pointer'}} onClick={() => props.history.push(`/${urlFormat}`)}>{props.heading}</button>
  );
};

export default withRouter(NavigationElement);
