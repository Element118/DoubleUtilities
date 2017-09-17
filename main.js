var RandomUtilities = (function() {
    /**
     * Get a random bit
     * @return string with 0 or 1
     */
    var getRandomBit = function() {
        return Math.random() < 0.5 ? "0" : "1";
    };
    /**
     * Get some random bits (TODO: optimise later)
     * @param numBits number of bits to get
     * @return string of random bits
     */
    var getRandomBits = function(numBits) {
        var bits = "";
        while (numBits) {
            bits += ("0".repeat(32)+Math.floor(Math.random()*Math.pow(2, 32)).toString(2)).slice(-Math.min(32, numBits));
            numBits -= Math.min(32, numBits);
        }
        return bits;
    };
    return {
        getRandomBit: getRandomBit,
        getRandomBits: getRandomBits
    };
})();

/**
 * Hacking together a small library such that this can handle slightly larger integers (for this, I guess it can handle up to 100 bits)
 */
var BiggerInt = (function() {
    var BiggerInt = function(config) {
        if (typeof config === "number") {
            this.divisor = Math.pow(2, 32);
            this.remainder = config%this.divisor;
            this.quotient = Math.floor(config/this.divisor);
            this.remainderBits = 32;
        } else {
            this.quotient = config.quotient || 0; 
            this.remainder = config.remainder || 0;
            this.remainderBits = config.remainderBits || 32;
            this.divisor = Math.pow(2, this.remainderBits);
        }
    };
    /**
     * Get random number from 0 to the current value
     * Precondition: current value is positive
     * Postcondition: return random number
     */
    BiggerInt.prototype.getRandom = function() {
        if (this.quotient < 0 || this.quotient === 0 && this.remainder === 0) { return NaN; }
        if (this.quotient === 0) {
            var numBits = Math.ceil(Math.log2(this.remainder));
            while (1) {
                var bits = RandomUtilities.getRandomBits(numBits);
                var result = parseInt(bits, 2);
                if (result < this.remainder) {
                    return new BiggerInt({
                        quotient: 0,
                        remainder: result,
                        remainderBits: this.remainderBits
                    });
                }
            }
        }
        var numBits = Math.ceil(Math.log2(this.quotient))+this.remainderBits;
        var bits = RandomUtilities.getRandomBits(numBits);
        while (1) {
            var bits = RandomUtilities.getRandomBits(numBits);
            var highResult = parseInt(bits.slice(0, -this.remainderBits), 2);
            var lowResult = parseInt(bits.slice(-this.remainderBits), 2);
            if (highResult < this.quotient || highResult === this.quotient && lowResult < this.remainder) {
                return new BiggerInt({
                    quotient: highResult,
                    remainder: lowResult,
                    remainderBits: this.remainderBits
                });
            }
        }
    };
    BiggerInt.prototype.accumulate = function(x) {
        if (typeof x === "number") {
            this.remainder += x%this.divisor;
            this.quotient += Math.floor(x/this.divisor);
            if (this.remainder >= this.divisor) {
                this.remainder -= this.divisor;
                this.quotient++;
            } else if (this.remainder < 0) {
                this.remainder += this.divisor;
                this.quotient--;
            }
        } else { // Bigger int
            // take note of case with different remainderBit
            return "Not yet implemented";
        }
    };
    /**
     * Compare with another BiggerInt
     * @return -1 if this is smaller, 0 if equal, 1 if larger
     */
    BiggerInt.prototype.compare = function(that) {
        if (this.divisor === that.divisor) {
            if (this.quotient !== that.quotient) {
                return Math.sign(this.quotient-that.quotient);
            }
            return Math.sign(this.remainder-that.remainder);
        } else { // Bigger int
            // take note of case with different remainderBit
            return "Not yet implemented";
        }
    };
    BiggerInt.prototype.valueOf = function() {
        return this.quotient*this.divisor+this.remainder;
    };
    return BiggerInt;
})();

var DoubleUtilities = (function() {
    /**
     * Get the bits of a number.
     * This should be equivalent to:
var getDoubleBits = function(x) {
    var buffer = new ArrayBuffer(8);
    (new Float64Array(buffer))[0] = x;
    var arr = new Uint32Array(buffer);
    return ("0".repeat(32)+arr[1].toString(2)).slice(-32)+("0".repeat(32)+arr[0].toString(2)).slice(-32);
};
     */
    var getBits = function(x) {
        // special cases
        var sign = x<0?"1":"0"; // one sign bit
        if (isNaN(x)) { // NaN cannot be compared via x === NaN as NaN !== NaN
            return "0111111111111000000000000000000000000000000000000000000000000000";
        } else if (x === Infinity) {
            return "0111111111110000000000000000000000000000000000000000000000000000";
        } else if (x === -Infinity) {
            return "1111111111110000000000000000000000000000000000000000000000000000";
        } else if (x === 0) {
            // -0 can be differentiated from 0 by this method
            return 1/x === Infinity?"0".repeat(64):"1"+"0".repeat(63);
        } else if (abs(x) < Math.pow(2, -1022)) { // denormal numbers
            x *= Math.pow(2, 1000);
            x *= Math.pow(2, 74); // make sure there is no overflow
            x = ("0".repeat(52)+abs(x).toString(2)).slice(-52);
            return sign+"0".repeat(11)+x;
        }
        var exponent = 1023; // exponent is offset by 1023
        x = abs(x); // now that sign is handled, remove sign
        // shift the number carefully (can be slightly optimised)
        var l = min(Math.round(Math.log2(abs(x))), 1023);
        exponent += l;
        x /= Math.pow(2, l);
        while (x >= 2) {
            exponent++;
            x /= 2;
        }
        // same careful shifting
        while (x < 1) {
            exponent--;
            x *= 2;
        }
        // get the mantissa
        x -= 1;
        x *= Math.pow(2, 52);
        x = ("0".repeat(52)+x.toString(2)).slice(-52); // 52 digits of mantissa
        exponent = ("0".repeat(11)+exponent.toString(2)).slice(-11); // 11 digits of exponent
        return sign+exponent+x; // combine results
    };
    var getExponent = function(x) {
        if (abs(x) < Math.pow(2, -1022)) {
            return 0;
        }
        var exponent = 1023; // exponent is offset by 1023
        x = abs(x); // now that sign is handled, remove sign
        // shift the number carefully (can be slightly optimised)
        var l = min(Math.round(Math.log2(abs(x))), 1023);
        exponent += l;
        x /= Math.pow(2, l);
        while (x >= 2) {
            exponent++;
            x /= 2;
        }
        // same careful shifting
        while (x < 1) {
            exponent--;
            x *= 2;
        }
        return exponent;
    };
    var decrementBitString = function(bits) {
        var i = bits.length;
        while (i--) {
            if (bits[i] === "1") {
                return bits.slice(0, i)+"0"+"1".repeat(bits.length-i-1);
            }
        }
    };
    var incrementBitString = function(bits) {
        var i = bits.length;
        while (i--) {
            if (bits[i] === "0") {
                return bits.slice(0, i)+"1"+"0".repeat(bits.length-i-1);
            }
        }
    };
    /**
     * Get number from bitstring of 64 bits.
     */
    var getNumber = function(bits) {
        if (bits.length !== 64) { return NaN; }
        var sign = bits[0]==="0"?1:-1;
        var exponent = parseInt(bits.slice(1, 12), 2)-1023;
        // Limitation in parseInt, can only do 32-bit numbers
        var mantissa = parseInt(bits.slice(12, 43), 2)*Math.pow(2, -31)+parseInt(bits.slice(43), 2)*Math.pow(2, -52);
        if (exponent === -1023) { // denormal
            return sign*mantissa*Math.pow(2, -1022);
        } else if (exponent === 1024) { // infinity, NaN
            if (mantissa) { return NaN; }
            return sign*Infinity;
        }
        return sign*(mantissa+1)*Math.pow(2, exponent);
    };
    /**
     * Return the next double.
     * If -Infinity, returns -Number.MAX_VALUE.
     * If Number.MAX_VALUE, returns Infinity.
     * If Infinity, returns Infinity.
     * If NaN, returns NaN.
     * If -0, returns +0.
     */
    var nextDouble = function(x) {
        if (isNaN(x)) {
            return NaN;
        } else if (x === 0 && 1/x === -Infinity) {
            return 0;
        } else if (x === Infinity) {
            return Infinity;
        }
        var bits = getBits(x);
        if (x>=0) {
            // increment exponent+mantissa
            return getNumber(bits[0]+incrementBitString(bits.slice(1)));
        } else {
            // decrement exponent+mantissa
            return getNumber(bits[0]+decrementBitString(bits.slice(1)));
        }
    };
    /**
     * Return the previous double.
     * If Infinity, returns the Number.MAX_VALUE.
     * If -Number.MAX_VALUE, returns -Infinity.
     * If -Infinity, returns -Infinity.
     * If NaN, returns NaN.
     * If +0, returns -0.
     */
    var prevDouble = function(x) {
        if (isNaN(x)) {
            return NaN;
        } else if (x === 0 && 1/x === Infinity) {
            return -0;
        } else if (x === -Infinity) {
            return -Infinity;
        }
        var bits = getBits(x);
        if (x>0) {
            // decrement exponent+mantissa
            return getNumber(bits[0]+decrementBitString(bits.slice(1)));
        } else {
            // increment exponent+mantissa
            return getNumber(bits[0]+incrementBitString(bits.slice(1)));
        }
    };
    /**
     * Generate a random number x in the range [a, b)
     * such that the number x has a probability
     * of (nextDouble(x)-x)/(b-a) of appearing
     * 
     * Alternatively, imagine actually generating a random number with uniform probability in [a, b) and round it down to the closest floating point number.
     * 
     * Math.random() gives 52 bits
     * random() gives 16 bits
     */
    var random = function(a, b) {
        if (a === undefined) {
            a = 0;
            b = 1;
        } else if (b === undefined) {
            b = a;
            a = 0;
        }
        if (a >= b) {
            return NaN; // I can't do this.
        }
        /**
         * cases:
         * a<0<b (easier)
         * 0<a<b
         * Is there a power of 2 between a and b?
         * No - generate from prefix
         * a<b<0 (similar to 0<a<b)
         */
        // smallest power of 2 bigger than a
        var smallestP2 = a>=0?Math.pow(2, Math.ceil(Math.log2(Math.abs(a)))):-Math.pow(2, Math.floor(Math.log2(Math.abs(a))));
        if (a <= 0 && 0 <= b || a >= 0 && smallestP2*2 <= b || a <= 0 && smallestP2/2 <= b) {
            var maxExponent = Math.max(Math.ceil(Math.log2(Math.abs(a))), Math.ceil(Math.log2(Math.abs(b))))+1023; // 1023 bias
            while (1) {
                var sign = a>=0?"0":b<=0?"1":RandomUtilities.getRandomBit();
                var exponent = maxExponent;
                var mantissa = RandomUtilities.getRandomBits(53); // generate a number from [0,2)
                // if begin with 0, add more bits, and decrement the exponent
                var oneIndex = mantissa.indexOf("1");
                if (oneIndex === -1) { oneIndex = mantissa.length; }
                while (mantissa[0] === "0" && exponent > 1) {
                    var change = Math.min(exponent-1, oneIndex);
                    exponent -= change;
                    mantissa = mantissa.slice(change) + RandomUtilities.getRandomBits(change);
                }
                if (exponent < 1) {
                    mantissa = ("0".repeat(1-exponent))+mantissa;
                    exponent = 1;
                }
                //println(sign + ("0".repeat(11) + exponent.toString(2)).slice(-11) + mantissa.slice(1, 53));
                var num;
                if (mantissa[0] === "0") { // denormal
                    num = getNumber(sign + "0".repeat(11) + mantissa.slice(1, 53));
                } else { // normalised
                    num = getNumber(sign + ("0".repeat(11) + exponent.toString(2)).slice(-11) + mantissa.slice(1, 53));
                }
                // 3. Decrement if negative
                if (sign === "1") {
                    num = prevDouble(num);
                }
                // 4. Check if in [a, b)
                if (a <= num && num < b) {
                    return num;
                }
            }
        } else if (Math.max(Math.abs(a), Math.abs(b)) <= Math.pow(2, -1021)) { // near denormal / denormal
            // all gaps are equal-sized, however b-a might not be a floating-point number, but we can split into cases
            if (a >= 0 && b >= 0 || a <= 0 && b <= 0) {
                // case 1: same sign
                var diff = b - a;
                var numBits = Math.ceil(Math.log2(diff))+1074;
                while (1) {
                    var bits = RandomUtilities.getRandomBits(numBits);
                    var result = a + (parseInt(bits.slice(0, -32), 2)*Math.pow(2, 32)+parseInt(bits.slice(-32), 2))*Math.pow(2, -1074);
                    // make sure it is a positive 0
                    if (result === 0) { result = 0; }
                    if (result < b) { return result; }
                }
            } else {
                // case 2: different sign
                var diff = b - a;
                var numBits = Math.max(Math.ceil(Math.log2(Math.abs(b))), Math.ceil(Math.log2(Math.abs(a))))+1074;
                while (1) {
                    var sign = RandomUtilities.getRandomBit();
                    var bits = ("0".repeat(53)+RandomUtilities.getRandomBits(numBits)).slice(-53);
                    var result = getNumber(sign + "0000000000" + bits);
                    // decrement negative
                    if (sign === "1") { result = prevDouble(result); }
                    if (a <= result && result < b) { return result; }
                }
            }
        } else if (a > 0 && b >= smallestP2) { // only 1 power of 2 between a and b
            var gapSize = a-prevDouble(a);
            var smallGaps = (smallestP2-a)/gapSize; // < 2 ^ 52
            var largeGaps = (b-smallestP2)/gapSize/2; // < 2 ^ 52
            // get a random integer from 0 to smallGaps+2*largeGaps
            // however, smallGaps+2*largeGaps is not a safe integer, however it is at most 3*Math.pow(2^52), so generate 54 bits.
            // Integers up to 2^53 are all safe
            // Even integers up to 2^54 are all safe
            // We round smallGaps up to an even integer
            // Purpose: Calculate the smallest power of 2 >= 2*largeGaps+smallGaps (exact addition)
            var numBits = Math.ceil(Math.log2(2*largeGaps+(smallGaps+smallGaps%2)));
            var bint = new BiggerInt(smallGaps);
            var small = new BiggerInt(smallGaps);
            bint.accumulate(2*largeGaps);
            var r = bint.getRandom();
            if (r.compare(small) === -1) {
                return a + r.valueOf()*gapSize;
            } else {
                r.accumulate(-smallGaps);
                // hack into it if r is odd
                if (r.remainder % 2 === 1) {
                    r.remainder--;
                }
                return smallestP2 + r.valueOf()*gapSize;
            }
        } else if (b < 0 && b >= smallestP2) { // only 1 power of 2 between a and b
            var gapSize = a-prevDouble(a);
            var smallGaps = (smallestP2-a)/gapSize;
            var largeGaps = (b-smallestP2)/(gapSize/2);
            // get a random integer from 0 to smallGaps*2+largeGaps
            var numBits = Math.ceil(Math.log2(2*smallGaps+(largeGaps+largeGaps%2)));
            var bint = new BiggerInt(2*smallGaps);
            var small = new BiggerInt(2*smallGaps);
            bint.accumulate(largeGaps);
            var r = bint.getRandom();
            if (r.compare(small) === -1) {
                // hack into it if r is odd
                if (r.remainder % 2 === 1) {
                    r.remainder--;
                }
                return a + r.valueOf()*(gapSize/2);
            } else {
                r.accumulate(-smallGaps*2);
                return smallestP2 + r.valueOf()*(gapSize/2);
            }
        } else { // no powers of 2 in between
            var gapSize = nextDouble(a)-a;
            var gaps = (b-a)/gapSize;
            // get random int in [0, gaps)
            var numBits = Math.ceil(Math.log2(gaps));
            while (1) {
                var bits = RandomUtilities.getRandomBits(numBits);
                var num = parseInt(bits.slice(0, -32), 2)*Math.pow(2, 32)+parseInt(bits.slice(-32), 2);
                if (num < gaps) {
                    return a + gapSize * num;
                }
            }
        }
    };
    /**
     * Add a bunch of numbers together
     * https://en.wikipedia.org/wiki/Kahan_summation_algorithm#Further_enhancements
     */
    var add = function() {
        if (arguments.length === 0) { return 0; }
        var sum = arguments[0], c = 0;
        for (var i=1;i<arguments.length;i++) {
            var t = sum + arguments[i];
            if (abs(sum)>abs(arguments[i])) {
                c += (sum - t) + arguments[i];
            } else {
                c += (arguments[i] - t) + sum;
            }
            sum = t;
        }
        return sum + c;
    };
    return {
        getBits: getBits,
        getNumber: getNumber,
        nextDouble: nextDouble,
        prevDouble: prevDouble,
        random: random,
        add: add
    };
})();
