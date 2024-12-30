import { UserBillingModel } from "../Usage/schema/tokenSchema.mjs";


const handleTokenUsage = async (userId, tokenUsageEntry) => {
    
    try{
        const userCredit = await UserBillingModel.findOne({
            user: userId
        })

        console.log("this is the ", userCredit)

        if(!userCredit || userCredit.balance <= 0){
            throw new Error("Insufficient credits");
        }

        const totalInputTokensSpent = tokenUsageEntry.inputTokens
        const totalOutputTokensSpent = tokenUsageEntry.outputTokens

        const totalCost = (totalInputTokensSpent*inputtokenCostPerUnit) + 
        (totalOutputTokensSpent*outputtokenCostPerUnit)

        if (userCredit.balance < totalCost) {
            throw new Error("Insufficient credits to cover token usage.");
        }

        userCredit.balance -= totalCost;
        userCredit.lastUpdated = new Date();

        await userCredit.save();



    }catch(error){
        console.log('Error handling token usage:', error);
        throw new Error("Token usage failed: " + error.message);

    }
}



