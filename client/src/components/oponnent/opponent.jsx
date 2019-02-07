import React from 'react';
import PropTypes from 'prop-types';
import './styles/opponentdescription.css';
// connect to redux
import { connect } from 'react-redux';
import { clientEmitter } from '../../sockethandler';
import { socket as socketConstants } from '../../constants/index';
import {
  drawShape, drawBoundary,
} from '../game/scripts/canvas';

// custom components
import OpponentDescription from './opponentInfo';

// reads from store
const mapStateToProps = state => state;
const {
  clientEmit: {
    LOOK_FOR_OPPONENTS,
    OPPONENT_UNMOUNTED,
    INVITATION_SENT,
    INVITATION_DECLINED,
    INVITATION_ACCEPTED,
    START_GAME,
    UPDATED_CLIENT_SCREEN,
  },
} = socketConstants;

class Opponent extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      levelsRaised: 0,
      canvasLoaded: false,
    };
    this.canvasOpponent = React.createRef();
    this.feedCount = 0;
  }

  componentDidMount() {
    console.log('Opponent Mounted!!');
    const { socket: { temp } } = this.props;
    if (!temp) clientEmitter(LOOK_FOR_OPPONENTS, null);
  }

  componentDidUpdate(prevProps) {
    const { canvasLoaded } = this.state; // needed so that canvas loads only once!
    const { game: prevGame, socket: { temp: prevTemp } } = prevProps;
    const {
      game, onReset, toggleMultiplayer, socket: { temp },
    } = this.props;
    /* load Opponent Canvas */
    if (!canvasLoaded && this.canvasOpponent.current) {
      this.loadOpponentCanvas();
      this.setState({ canvasLoaded: true });
    }

    if (temp) {
      const tempKey = Object.keys(temp)[0];

      switch (tempKey) {
        case 'acceptedInvitation': {
          if (!prevTemp.acceptedInvitation) break;
          const { acceptedInvitation: { countdown: prevCountdown } } = prevTemp;
          const { acceptedInvitation: { countdown } } = temp;
          if (prevCountdown === 1 && countdown === 0) {
            clientEmitter(START_GAME, {
              opponentInfo: temp[tempKey],
              clientScreen: JSON.stringify(game),
            });
          }
        }
          break;
        case 'gameInProgress': {
          const { gameInProgress: { info, opponentScreen } } = temp;
          if (!prevTemp.gameInProgress) { // game started
            onReset();
            toggleMultiplayer();
          } else { // game running
            // Important its is not enough to emit every time
            // component updates, must emit when only the game
            // actually CHANGES!!, otherwise big performance
            // degredation if we have other things, like setstate
            // update the component, meaning a new emit on every component
            // update!!!
            const { gameInProgress: { opponentScreen: prevOpponentScreen } } = prevTemp;
            // set opponent screen on socket data only if there is a difference in the opp game.
            if (opponentScreen !== prevOpponentScreen) {
              this.setGame(opponentScreen, prevOpponentScreen);
            }
            // emit client data only if there is a difference in client game.
            if (JSON.stringify(prevGame) === JSON.stringify(game)) return;
            clientEmitter(UPDATED_CLIENT_SCREEN, {
              opponentSID: info.opponentSID,
              clientScreen: JSON.stringify(game),
            });
          }
        }
          break;
        case 'gameOver': {
          const { socket, onGameOver } = this.props;
          const message = temp.gameOver.winnerSID === socket.mySocketId
            ? 'You Won !!'
            : 'You Lost !!';
          if (!prevTemp.gameOver) {
            onGameOver(message);
            toggleMultiplayer();
          }
        }
          break;
        default:
          break;
      }
    }
  }

  componentWillUnmount() {
    const { socket: { temp } } = this.props;
    // if a person leaves component in the middle of an invitation
    if (temp.invitationFrom) clientEmitter(INVITATION_DECLINED, temp);
    clientEmitter(OPPONENT_UNMOUNTED, null);
    // socket.emit('COMPONENT_UNMOUNTED', 'opponent');
    // socket.emit('disconnect', '');
  }

  loadOpponentCanvas = () => {
    const canvasOpponent = this.canvasOpponent.current;
    canvasOpponent.style.backgroundColor = 'black';
    // setting context so it can be accesible everywhere in the class , maybe a better way ?
    this.canvasOpponentContext = canvasOpponent.getContext('2d');
    this.canvasOpponentContext.canvas.hidden = true;
  }

  setGame = (opponentScreen, prevOpponentScreen) => {
    if (!opponentScreen) return;
    const { onCanvasFocus } = this.props;
    const { socket: { temp } } = this.props;
    const opp = JSON.parse(opponentScreen);
    const prevOpp = prevOpponentScreen ? JSON.parse(prevOpponentScreen) : null;
    if (temp.gameOver) return;
    if (opp && prevOpp) this.processFloorRaise(opp, prevOpp);
    if (this.canvasOpponentContext.canvas.hidden) this.canvasOpponentContext.canvas.hidden = false;
    onCanvasFocus();
    opp.activeShape.unitBlockSize /= 2;
    drawShape(this.canvasOpponentContext, opp, true);
  }

  setDifficulty = (val) => {
    const { onSetDifficulty } = this.props;
    onSetDifficulty(val);
  }

  processFloorRaise = (currentGame, previousGame) => {
    const { levelsRaised } = this.state;
    const {
      socket:
        {
          temp:
          {
            gameInProgress:
            {
              info: { difficulty },
            },
          },
        }, onFloorRaise,
    } = this.props;
    const {
      points: { totalLinesCleared: previouslyClearedLines },
      rubble: { boundaryCells: prevBoundryCells },
    } = previousGame;
    const {
      points: { totalLinesCleared },
      rubble: { boundaryCells },
    } = currentGame;
    // draw boundry in opponent screen if floor raise
    if (boundaryCells.length !== prevBoundryCells.length) {
      const copyOfGame = JSON.parse(JSON.stringify(currentGame));
      copyOfGame.activeShape.unitBlockSize /= 2;
      drawBoundary(this.canvasOpponentContext, copyOfGame, true);
    }
    const linesCleared = totalLinesCleared - previouslyClearedLines;
    // return if no new lines have been cleared
    if (!linesCleared) return;
    /*
    Difficulty                                 Description
    -----------------------------------------------------------------------------------
      1               After player clears 4 rows , floor is raised by 1 row on opponent
      2               After player clears 3 rows , floor is raised by 1 row on opponent
      3               After player clears 2 rows , floor is raised by 1 row on opponent
      4               After player clears 1 row  , floor is raised by 1 row on opponent
    */
    const difficultyMap = [[4, 1], [3, 2], [2, 3], [1, 4]]; // [[level, ]]
    // number of floors that needs to be cleared for a single floor raise on opp
    const amountNeededForRaise = difficultyMap.filter(d => d[0] === difficulty)[0][1];
    // Includes any surplus from previous lines cleared
    const totalRaisedByClient = levelsRaised + linesCleared;
    if (totalRaisedByClient >= amountNeededForRaise) {
      // Total levels to be raised on opponent
      const raiseOnOpponent = Math.floor(totalRaisedByClient / amountNeededForRaise);
      // To store for client if any surplus
      const storeForClient = totalRaisedByClient - (raiseOnOpponent * amountNeededForRaise);
      this.setState({ levelsRaised: storeForClient }, () => onFloorRaise(Number(raiseOnOpponent)));
    } else this.setState({ levelsRaised: totalRaisedByClient });
  }

  /* process socket-out-going below */
  requestInvite = (sentTo) => {
    const { difficulty } = this.props;
    clientEmitter(INVITATION_SENT, { sentTo, difficulty });
    // socket.emit('INVITATION_SENT', { hostSocketId: p, difficulty: this.props.difficulty });
  }

  declineInvite = () => {
    const { socket: { temp } } = this.props;
    clientEmitter(INVITATION_DECLINED, temp);
    clientEmitter(LOOK_FOR_OPPONENTS, null);
  };

  acceptInvite = () => {
    const { onReset, socket: { temp } } = this.props;
    onReset(false);
    if (this.canvasOpponentContext
      && !this.canvasOpponentContext.canvas.hidden) this.canvasOpponentContext.canvas.hidden = true;
    // const { onSetDifficulty } = this.props;
    clientEmitter(INVITATION_ACCEPTED, temp);
    // onSetDifficulty(status[1][1]);
  }

  resetMultiplayer = () => {
    const { onReset } = this.props;
    onReset(false);
    clientEmitter(LOOK_FOR_OPPONENTS, null);
    if (!this.canvasOpponentContext.canvas.hidden) this.canvasOpponentContext.canvas.hidden = true;
  }
  /* done sockets */

  render() {
    const { difficulty, game, socket } = this.props;
    if (!socket.temp) return null;
    return (
      <div className="opponentContainer">
        <OpponentDescription
          socketState={socket}
          difficulty={difficulty}
          setDifficulty={this.setDifficulty}
          requestInvite={sId => this.requestInvite(sId)}
          acceptInvite={() => this.acceptInvite()}
          declineInvite={() => this.declineInvite()}
          getPool={() => this.resetMultiplayer()}
        />
        <canvas
          ref={this.canvasOpponent}
          width={game.canvas.canvasMajor.width / 2}
          height={game.canvas.canvasMajor.height / 2}
        />
      </div>
    );
  }

}

Opponent.defaultProps = {
  game: {}, // client game in redux store
  socket: {}, // socket info in redux store
  onFloorRaise: null,
  onReset: null, // callback to main game
  onSetDifficulty: null,
  difficulty: 2,
  onGameOver: null,
  toggleMultiplayer: null,
  onCanvasFocus: null,
};
Opponent.propTypes = {
  socket: PropTypes.objectOf(PropTypes.any),
  game: PropTypes.objectOf(PropTypes.any),
  difficulty: PropTypes.number,
  onFloorRaise: PropTypes.func,
  onReset: PropTypes.func,
  onSetDifficulty: PropTypes.func,
  onGameOver: PropTypes.func,
  toggleMultiplayer: PropTypes.func,
  onCanvasFocus: PropTypes.func,
};

export default connect(mapStateToProps)(Opponent);
