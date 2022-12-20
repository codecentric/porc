import sinonChai from 'sinon-chai'
import sinonChaiInOrder from 'sinon-chai-in-order'
import chai from 'chai'
import sinon from 'sinon'
import chaiAsPromised from 'chai-as-promised'
import like from 'chai-like'

chai.use(sinonChai)
chai.use(sinonChaiInOrder)
chai.use(chaiAsPromised)
chai.should()

like.extend({
    match: function (object, expected) {
        return typeof object === 'string' && expected instanceof RegExp
    },
    assert: function (object, expected) {
        return expected.test(object)
    }
})
chai.use(like)

afterEach(() => {
    sinon.restore()
})
