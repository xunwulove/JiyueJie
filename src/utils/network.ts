import { emptyFunction } from "@/constants/commonConst";
import NetInfo from "@react-native-community/netinfo";

enum NetworkState {
    Offline = "Offline",
    Wifi = "Wifi",
    Cellular = "Cellular",
}

class Network {
    private _state: NetworkState = NetworkState.Wifi;

    /** 获取网络状态 */
    get state() {
        return this._state;
    }

    /** 是否离线 */
    get isOffline() {
        return this._state === NetworkState.Offline;
    }

    /** 是否处于wifi环境 */
    get isWifi() {
        return this._state === NetworkState.Wifi;
    }

    /** 是否处于移动网络环境 */
    get isCellular() {
        return this._state === NetworkState.Cellular;
    }

    /** 是否链接网络 */
    get isConnected() {
        return this._state !== NetworkState.Offline;
    }

    constructor() {
        NetInfo.fetch().then(state => {
            this.mapState(state);
        }).catch(emptyFunction);

        NetInfo.addEventListener(state => {
            this.mapState(state);
        });
    }

    private mapState(state: any) {
        if (state.type === "none") {
            this._state = NetworkState.Offline;
        } else if (state.type === "cellular") {
            this._state = NetworkState.Cellular;
        } else {
            // wifi/ethernet/vpn/bluetooth/unknown：可联网且非蜂窝计费 → 按 Wifi 处理，
            // 避免 USB 网络共享/以太网/热点被误判为蜂窝导致在线播放被禁
            this._state = NetworkState.Wifi;
        }
    }

}

const network = new Network();
export default network;
