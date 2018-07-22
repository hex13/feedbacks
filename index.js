const Resmix = require('./resmix');

exports.createEngine = (blueprint) => {
    const finalBlueprint = (
        typeof blueprint == 'function'? 
        blueprint({
            init: Resmix.init
        }) : blueprint
    );
    return Resmix.Resmix(finalBlueprint);
}


exports.withRedux = (Redux) => ({
    createStore(blueprint) {
        const engine = exports.createEngine(blueprint);
        return Redux.createStore(engine.reducer, Redux.applyMiddleware(engine.middleware))
    }
});