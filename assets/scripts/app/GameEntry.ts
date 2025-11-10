import EventBus from './EventBus';
import { AppSignal } from './AppSignals';
import { debugLog, setDebug } from '../debug/Debug';
import { TileClickPayload } from '../shared/types';
import BoardFiller from '../board/BoardFiller';
import HUDScore from '../ui/HUDScore';
import GameController from './GameController';
import PopupNoMoves from '../ui/PopupNoMoves';
import BoosterTeleportButton from '../ui/BoosterTeleportButton';
import BoosterBombButton from '../ui/BoosterBombButton';
import PopupSimple from '../ui/PopupSimple';

const { ccclass, property } = cc._decorator;

@ccclass
export default class GameEntry extends cc.Component {
  @property(cc.Node)
  overlayRoot: cc.Node = null;

  @property(PopupSimple)
  popupWin: PopupSimple = null;

  @property(PopupSimple)
  popupLose: PopupSimple = null;

  @property(PopupNoMoves)
  popupNoMoves: PopupNoMoves = null;

  @property(BoardFiller)
  boardFiller: BoardFiller = null;

  @property(HUDScore)
  hudScore: HUDScore = null;

  @property(BoosterTeleportButton)
  boosterTeleportButton: BoosterTeleportButton = null;

  @property(BoosterBombButton)
  boosterBombButton: BoosterBombButton = null;

  private controller: GameController = null;

  onLoad() {
    // Toggle to true locally to see debug logs
    setDebug(false);
    debugLog('GameEntry', 'onLoad');

    this.hideAllPopups();

    if (!this.boardFiller) {
      debugLog('GameEntry', 'ERROR: boardFiller is not assigned');
      return;
    }

    this.controller = new GameController(this.boardFiller, this.hudScore);

    this.controller.onWin = () => this.showWin();
    this.controller.onLose = () => this.showLose();
    this.controller.onNoMoves = (left) => {
      debugLog('GameEntry', `NO MOVES, reshufflesLeft=${left}`);

      if (!this.overlayRoot || !this.popupNoMoves) return;

      this.overlayRoot.active = true;

      if (this.popupWin) this.popupWin.hide();
      if (this.popupLose) this.popupLose.hide();

      this.popupNoMoves.show(left);
    };

    this.controller.onBombsChanged = (bombsLeft) => {
      if (this.boosterBombButton) {
        this.boosterBombButton.setCount(bombsLeft);
      }
    };

    this.controller.onTeleportsChanged = (teleportsLeft) => {
      if (this.boosterTeleportButton) {
        this.boosterTeleportButton.setCount(teleportsLeft);
      }
    };

    EventBus.I.on(AppSignal.SHOW_POPUP_WIN, this.onShowWinSignal);
    EventBus.I.on(AppSignal.SHOW_POPUP_LOSE, this.onShowLoseSignal);
    EventBus.I.on(AppSignal.HIDE_POPUPS, this.onHidePopupsSignal);
    EventBus.I.on(AppSignal.TILE_CLICKED, this.onTileClickedSignal);
    EventBus.I.on(
      AppSignal.BOOSTER_TELEPORT_CLICKED,
      this.onBoosterTeleportSignal
    );
    EventBus.I.on(AppSignal.NO_MOVES_OK_CLICKED, this.onNoMovesOkSignal);
    EventBus.I.on(AppSignal.BOOSTER_BOMB_CLICKED, this.onBoosterBombSignal);

    this.controller.initNewGame();
    this.syncBoosterStates();

    if (this.popupWin) this.popupWin.onOk = () => this.onPopupOkClicked();
    if (this.popupLose) this.popupLose.onOk = () => this.onPopupOkClicked();
  }

  onDestroy() {
    EventBus.I.off(AppSignal.SHOW_POPUP_WIN, this.onShowWinSignal);
    EventBus.I.off(AppSignal.SHOW_POPUP_LOSE, this.onShowLoseSignal);
    EventBus.I.off(AppSignal.HIDE_POPUPS, this.onHidePopupsSignal);
    EventBus.I.off(AppSignal.TILE_CLICKED, this.onTileClickedSignal);
    EventBus.I.off(
      AppSignal.BOOSTER_TELEPORT_CLICKED,
      this.onBoosterTeleportSignal
    );
    EventBus.I.off(AppSignal.NO_MOVES_OK_CLICKED, this.onNoMovesOkSignal);
    EventBus.I.off(AppSignal.BOOSTER_BOMB_CLICKED, this.onBoosterBombSignal);
  }

  // === POPUPS ===

  private showWin() {
    debugLog('GameEntry', 'showWin()');
    if (!this.overlayRoot || !this.popupWin) return;

    this.overlayRoot.active = true;

    if (this.popupLose) this.popupLose.hide();
    if (this.popupNoMoves) this.popupNoMoves.node.active = false;

    this.popupWin.show('ПОБЕДА!');
  }

  private showLose() {
    debugLog('GameEntry', 'showLose()');
    if (!this.overlayRoot || !this.popupLose) return;

    this.overlayRoot.active = true;

    if (this.popupWin) this.popupWin.hide();
    if (this.popupNoMoves) this.popupNoMoves.node.active = false;

    this.popupLose.show('ПРОИГРЫШ');
  }

  private hideAllPopups() {
    if (this.overlayRoot) this.overlayRoot.active = false;

    if (this.popupWin) this.popupWin.node.active = false;
    if (this.popupLose) this.popupLose.node.active = false;
    if (this.popupNoMoves) this.popupNoMoves.node.active = false;
  }

  // === EVENTBUS HANDLERS ===

  private onShowWinSignal = () => this.showWin();
  private onShowLoseSignal = () => this.showLose();
  private onHidePopupsSignal = () => this.hideAllPopups();

  private onTileClickedSignal = (payload: TileClickPayload) => {
    if (!this.controller) return;

    this.controller.onTileClick(payload);
    this.syncBoosterStates();
  };

  private onBoosterTeleportSignal = () => {
    if (!this.controller) return;

    this.controller.onBoosterTeleportClick();
    this.syncBoosterStates();
  };

  private onBoosterBombSignal = () => {
    if (!this.controller) return;

    this.controller.onBoosterBombClick();
    this.syncBoosterStates();
  };

  private onNoMovesOkSignal = () => {
    if (!this.controller) return;

    if (this.popupNoMoves) {
      this.popupNoMoves.hide();
    }
    if (this.overlayRoot) {
      this.overlayRoot.active = false;
    }

    this.controller.onNoMovesPopupOk();
    this.syncBoosterStates();
  };

  /** "OK" button click in win/lose popup. */
  public onPopupOkClicked() {
    this.hideAllPopups();

    if (!this.controller) return;

    this.controller.onRestartRequested();
    this.syncBoosterStates();
  }

  // === HELPERS ===

  private syncBoosterStates() {
    if (!this.controller) return;

    if (this.boosterTeleportButton) {
      this.boosterTeleportButton.setActive(this.controller.isTeleportActive());
    }

    if (this.boosterBombButton) {
      this.boosterBombButton.setActive(this.controller.isBombActive());
    }
  }
}
