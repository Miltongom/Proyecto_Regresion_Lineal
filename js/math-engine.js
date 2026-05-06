class LinearRegressionEngine {
    constructor(xData, yData, m0, b0, learningRate) {
        this.xData = [...xData];
        this.yData = [...yData];
        this.initialM = Number(m0);
        this.initialB = Number(b0);
        this.m = Number(m0);
        this.b = Number(b0);
        this.learningRate = Number(learningRate);
        this.n = this.xData.length;
        this.history = [];
        this.currentIteration = 0;
    }

    calcPredictions(m = this.m, b = this.b) {
        return this.xData.map((x) => (m * x) + b);
    }

    calcErrors(yData, yHat) {
        return yData.map((y, index) => y - yHat[index]);
    }

    calcSquaredErrors(errors) {
        return errors.map((error) => error ** 2);
    }

    calcMSE(squaredErrors) {
        const total = squaredErrors.reduce((sum, value) => sum + value, 0);
        return total / this.n;
    }

    calcGradientB(errors) {
        const errorSum = errors.reduce((sum, value) => sum + value, 0);
        return (-2 / this.n) * errorSum;
    }

    calcGradientM(errors, xData = this.xData) {
        const weightedSum = errors.reduce((sum, value, index) => sum + (value * xData[index]), 0);
        return (-2 / this.n) * weightedSum;
    }

    performIteration() {
        const m_before = this.m;
        const b_before = this.b;
        const yHat = this.calcPredictions(m_before, b_before);
        const errors = this.calcErrors(this.yData, yHat);
        const squaredErrors = this.calcSquaredErrors(errors);
        const mse = this.calcMSE(squaredErrors);
        const gradB = this.calcGradientB(errors);
        const gradM = this.calcGradientM(errors, this.xData);
        const newM = m_before - (this.learningRate * gradM);
        const newB = b_before - (this.learningRate * gradB);

        this.m = newM;
        this.b = newB;
        this.currentIteration += 1;

        const result = {
            iterationNumber: this.currentIteration,
            m_before,
            b_before,
            yHat,
            errors,
            squaredErrors,
            mse,
            gradB,
            gradM,
            newM,
            newB
        };

        this.history.push(result);
        return result;
    }

    runNIterations(n) {
        const results = [];
        for (let index = 0; index < n; index += 1) {
            results.push(this.performIteration());
        }
        return results;
    }

    reset(m0 = this.initialM, b0 = this.initialB) {
        this.initialM = Number(m0);
        this.initialB = Number(b0);
        this.m = Number(m0);
        this.b = Number(b0);
        this.history = [];
        this.currentIteration = 0;
    }
}

window.LinearRegressionEngine = LinearRegressionEngine;