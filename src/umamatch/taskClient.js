const ENDPOINTS = {
    daily: '/api/v1/client/task/list-daily',
    milestone: '/api/v1/client/task/milestone',
    oneTime: '/api/v1/client/task/list-one-time',
    claimReward: '/api/v1/client/task/claim-reward',
    reportShare: '/api/v1/client/task/report-share',
    userAsset: '/api/v1/client/user/asset',
    userInfo: '/api/v1/client/user/info',
    lotteryTickets: '/api/v1/client/asset/tickets',
    lotteryPrizeList: '/api/v1/client/lottery/prize-list',
    lotteryDraw: '/api/v1/client/lottery/draw'
};

class UmamatchTaskClient {
    constructor({ request }) {
        if (typeof request !== 'function') {
            throw new Error('UmamatchTaskClient requires a request function');
        }
        this.request = request;
    }

    async getData(method, path, body) {
        const response = await this.request({ method, path, body });
        if (!response || response.code !== 0) {
            const code = response && response.code !== undefined ? response.code : 'unknown';
            const message = response && response.message ? response.message : 'unknown error';
            throw new Error(`${path} failed: ${message} (${code})`);
        }
        return response.data;
    }

    async getDailyTasks() {
        return this.getData('GET', ENDPOINTS.daily);
    }

    async getMilestoneTasks() {
        return this.getData('GET', ENDPOINTS.milestone);
    }

    async getOneTimeTasks() {
        return this.getData('GET', ENDPOINTS.oneTime);
    }

    async getUserAsset() {
        return this.getData('GET', ENDPOINTS.userAsset);
    }

    async getUserInfo() {
        return this.getData('GET', ENDPOINTS.userInfo);
    }

    async getLotteryTickets() {
        return this.getData('GET', ENDPOINTS.lotteryTickets);
    }

    async getLotteryPrizeList() {
        return this.getData('GET', ENDPOINTS.lotteryPrizeList);
    }

    async assertLoggedIn() {
        const info = await this.getUserInfo();
        if (!info || info.guest === true) {
            throw new Error('UMA Match API login check failed: guest session');
        }
        if (!info.userId) {
            throw new Error('UMA Match API login check failed: missing user id');
        }
        return info;
    }

    async claimReward(taskId) {
        return this.getData('POST', ENDPOINTS.claimReward, { taskId });
    }

    async reportShare(taskId) {
        return this.getData('POST', ENDPOINTS.reportShare, { taskId });
    }

    async drawLottery() {
        return this.getData('POST', ENDPOINTS.lotteryDraw);
    }
}

module.exports = {
    ENDPOINTS,
    UmamatchTaskClient
};
