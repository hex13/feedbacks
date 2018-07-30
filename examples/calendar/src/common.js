import React from 'react';
import { connect } from 'react-redux';

export { React };
export { connect };

const texts = {
    navigation: {
        forward: {
          iconic: '>>',  
          en: 'Forward',
        },
        backward: {
            iconic: '<<',    
            en: 'Backward',
        }
    }
};

export function getLabel(kind, lang) {
    return texts.navigation[kind][lang];
}
