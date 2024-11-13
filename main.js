const ethers = require('ethers')
const zeroAddress = "0x0000000000000000000000000000000000000000"
const abi = require("./PAXG.json")
const rwaAddress = "0x45804880De22913dAFE09f4980848ECE6EcbAf78"
const RPC_URL = [
    "https://mainnet.infura.io/v3/05c6709f3eed48eb89c7e82d7a43c0dc",
    "https://mainnet.infura.io/v3/63b354d57387411191e8c4819970577b"
]

let currentProviderIndex = 0
const providers = RPC_URL.map(url => new ethers.providers.JsonRpcProvider(url))
const contracts = providers.map(provider => new ethers.Contract(rwaAddress, abi, provider))
const deployedBlockNumber = 8426333;
const recoveryBlockNumber = [];

(async() => {
    const coinGeckoSaid = (ethers.utils.parseEther("97739924")).toString()
    console.log(coinGeckoSaid)
    const totalSupply = await getTotalSupply();
    const totalReducededAmount = await getAllReducedTotalSupply();
    const calculatedRecoveryBlock = await calculateRecoveryBlock();

    console.log(totalSupply)
    console.log(totalReducededAmount,'+' ,calculatedRecoveryBlock ,"=" , totalReducededAmount + calculatedRecoveryBlock);
})()

function getNextProvider() {
    const provider = providers[currentProviderIndex]
    currentProviderIndex = (currentProviderIndex + 1) % providers.length
    return provider
}

function getNextContract() {
    const contract = contracts[currentProviderIndex]
    currentProviderIndex = (currentProviderIndex + 1) % contracts.length
    return contract
}

async function getReducedAmount(start, end) {
    let totalReduceded = 0;
    const contract = getNextContract()
    const filter = contract.filters.Transfer();
    try {
        const events = await contract.queryFilter(filter, start, end);
        for(let event of events){
            const args = event.args;
            if(!args) continue;
            const {to, value} = args;
            to === zeroAddress && console.log(`🔥${ethers.utils.formatEther(String(value))}`)
            totalReduceded += Number(ethers.utils.formatEther(String(value)))
        }
        return totalReduceded;
    } catch (error) {
        console.error(`Error fetching block range ${start}-${end}:`, error)
        recoveryBlockNumber.push([start,end])
        // throw error
    }
}

async function getAllReducedTotalSupply() {

    try {
        let start = deployedBlockNumber;
        let temp = start
        const latestBlock = await getNextProvider().getBlockNumber()
        console.log('latest', latestBlock)
        const results = []
        
        while(start < latestBlock) {
            const tasks = []
            for(let i in [1,2]) {
                const end = Math.min(start + 10000, latestBlock);
                tasks.push(getReducedAmount(start, end));
                start = end + 1
            }
            const result = await Promise.all(tasks);
            results.push(result)
        }
        let amount = 0
        console.log(results)
        // 並列でタスクを実行
       for(let supplys of results) {
        for (let supply of supplys) {
            amount += supply
        }
       }
        return amount
    } catch(e) {
        console.log('Error in getAllReducedTotalSupply:', e);
        throw e
    }
}

async function calculateRecoveryBlock() {
    const  tasks = []
    for(let startEnd of recoveryBlockNumber) {
        const start = startEnd[0]
        const end = startEnd[1]
        tasks.push(getReducedAmount(start, end));
    }
    const results = await Promise.all(tasks);
    const reduceded = results.reduce((acc, curr) => acc + curr, 0)
    return reduceded
}

async function getTotalSupply() {
    const contract = getNextContract()
    const totalSupply = await contract.totalSupply();
    return totalSupply.toString()
}