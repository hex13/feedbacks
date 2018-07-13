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