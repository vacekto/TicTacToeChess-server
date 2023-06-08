const boundary = 10000000

let start = Date.now();
for (let i = 0; i < boundary; i++) { }
let end = Date.now();

// elapsed time in milliseconds
let elapsed = end - start;

    // Send Hello
    console.log(elapsed / 1000, ' seconds')
    process.send?.({
        test: 'hahaha'
    });

// converting milliseconds to seconds
// by dividing 1000
// console.log('boundary: ', boundary, ', time elapsed: ', elapsed / 1000);