/// <reference types="chai" />
/// <reference types="sinon" />


declare module 'sinon-chai-in-order' {
    global {
        export namespace Chai {

            interface LanguageChains {
                subsequently: Assertion
            }
        }
    }

    const sinonChaiInOrder: Chai.ChaiPlugin;
    namespace sinonChaiInOrder { }
    export = sinonChaiInOrder;
}
