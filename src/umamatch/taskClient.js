const ENDPOINTS = {
    daily: '/api/v1/client/task/list-daily',
    milestone: '/api/v1/client/task/milestone',
    oneTime: '/api/v1/client/task/list-one-time',
    claimReward: '/api/v1/client/task/claim-reward',
    userAsset: '/api/v1/client/user/asset'
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

    async claimReward(taskId) {
        return this.getData('POST', ENDPOINTS.claimReward, { taskId });
    }
}

module.exports = {
    ENDPOINTS,
    UmamatchTaskClient
};
