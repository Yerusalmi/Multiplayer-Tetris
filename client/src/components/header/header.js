import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Redirect, withRouter } from 'react-router-dom';
import getUser from '../../redux/actions/authentication';
import { clientEmitter } from '../../sockethandler';
import { socket as socketConstants } from '../../constants/index';
import Menu from '../menu/menu';
import Invitation from './invitation';
import './styles/header.css';
import soundFile from './styles/invite_recieved.wav';

const mapStateToProps = state => state;
const mapDispatchToProps = dispatch => bindActionCreators({ getUser }, dispatch);
const {
  clientEmit: {
    SEND_LOGGED_IN_USER, USER_LOGGED_OUT, INVITATION_DECLINED,
    LOOK_FOR_OPPONENTS, INVITATION_ACCEPTED,
  },
} = socketConstants;

class Header extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      inviteReceived: null,
      inviteAccepted: null,
    };
  }

  componentDidMount() {
    this.loadUser();
  }

  componentDidUpdate(prevProps) {
    const { inviteAccepted } = this.state;
    const { socket: prevSocket } = prevProps;
    const { socket } = this.props;
    if (Object.keys(socket).includes('temp')) {
      if (!prevSocket.temp && socket.temp.invitationFrom) {
        this.setState({ inviteReceived: socket.temp.invitationFrom.displayname.split(' ')[0] });
        this.audio.play();
      }
      if (prevSocket.temp && !prevSocket.temp.invitationFrom && socket.temp.invitationFrom) {
        this.setState({ inviteReceived: socket.temp.invitationFrom.displayname.split(' ')[0] });
        this.audio.play();
      }
      if (prevSocket.temp && prevSocket.temp.invitationFrom && !socket.temp.invitationFrom) {
        this.setState({ inviteReceived: null });
      }
    }
    if (inviteAccepted) this.setState({ inviteAccepted: null });
  }

  loadUser = async () => {
    const { getUser: getUserStatus } = this.props;
    await getUserStatus();
    const { user } = this.props;
    const payloadToSend = user.profile.authenticated ? user.profile : null;
    clientEmitter(
      SEND_LOGGED_IN_USER,
      payloadToSend,
    );
  }

  logOutUser = async () => {
    const { getUser: getUserStatus } = this.props;
    await getUserStatus();
    const { user } = this.props;
    user.profile.remove = true;
    clientEmitter(USER_LOGGED_OUT, user.profile);
    window.location.assign('/auth/logout');
  }

  declineInvite = () => {
    const { socket: { temp } } = this.props;
    clientEmitter(INVITATION_DECLINED, temp);
    clientEmitter(LOOK_FOR_OPPONENTS, null);
  };

  acceptInvite = () => {
    const { socket } = this.props;
    this.setState({ inviteAccepted: true }, () => clientEmitter(INVITATION_ACCEPTED, socket.temp));
  }

  audioPlayer = () => (
    <audio ref={(input) => { this.audio = input; }} src={soundFile}>
      <track kind="captions" />
    </audio>
  )

  render() {
    const { inviteReceived, inviteAccepted } = this.state;
    const { user, socket } = this.props;
    const usersMessage = socket.usersLoggedIn
      ? `${socket.usersLoggedIn}  logged in user${socket.usersLoggedIn < 2 ? '' : 's'}`
      : null;
    if (user.profile) {
      const { user: { profile: { authenticated } } } = this.props;
      return (
        <div id="header">
          {
            authenticated
              ? (
                <React.Fragment>
                  <Menu onLogOut={this.logOutUser} />
                  {
                    inviteReceived
                      ? (
                        <Invitation
                          name={inviteReceived}
                          onDeclineInvite={this.declineInvite}
                          onAcceptInvite={this.acceptInvite}
                        />
                      )
                      : null
                  }
                  {
                    inviteAccepted
                      ? <Redirect to="/" />
                      : null
                  }
                </React.Fragment>
              )
              : <div id="authbutton"><button id="login" type="submit" onClick={() => window.location.assign('/auth/google')} /></div>
          }
          <div
            id="users"
            role="button"
            tabIndex={-1}
            onKeyDown={() => {}}
            onClick={() => clientEmitter('pool', null)}
          >
            <span>{usersMessage}</span>
          </div>
          {this.audioPlayer()}
        </div>
      );
    }
    return <div id="header" />;
  }

}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Header));

Header.defaultProps = {
  user: null,
  socket: null,
};

Header.propTypes = {
  getUser: PropTypes.func.isRequired,
  socket: PropTypes.shape({
    usersLoggedIn: PropTypes.number,
  }),
  user: PropTypes.shape({
    profile: PropTypes.shape({
      authenticated: PropTypes.bool.isRequired,
    }),
  }),
  location: PropTypes.shape({
    pathname: PropTypes.string.isRequired,
  }).isRequired,
};
