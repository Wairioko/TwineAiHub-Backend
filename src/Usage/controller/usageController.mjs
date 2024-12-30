import { UserBillingModel } from "../schema/tokenSchema.mjs";
import mongoose from "mongoose";


export const TokenUsage = async (req, res) => {
    const modelCosts = {
        Gemini: {
            inputTokenCost: 0.000000075,
            outputTokenCost: 0.0000003
        },
        ChatGpt: {
            inputTokenCost: 0.0000025,
            outputTokenCost: 0.00001
        },
        Claude: {
            inputTokenCost: 0.000003,
            outputTokenCost: 0.000015
        }
    };

    try {
        
        const user = req.user;

        if (!user) {
            return res.status(404).send("User Not Found");
        }

        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); // Previous month

        const userid = user.userId;
        const userId = new mongoose.Types.ObjectId(userid);

        const userBilling = await UserBillingModel.findOne({ user: userId });
        
        if (!userBilling) {
            return res.status(404).send("No billing data found for this user");
        }

        // Convert Mongoose document to plain JavaScript object
        const tokenUsageArray = userBilling.tokenUsage.map(doc => 
            typeof doc.toObject === 'function' ? doc.toObject() : doc
        );

        // Debug the actual data structure after conversion
        console.log("Data structure after conversion:", {
            firstEntry: tokenUsageArray[0],
            dateTypes: {
                date: tokenUsageArray[0]?.date ? typeof tokenUsageArray[0].date : 'undefined',
                timestamp: tokenUsageArray[0]?.timestamp ? typeof tokenUsageArray[0].timestamp : 'undefined'
            }
        });

        // Filter token usage data
        const tokenUsageData = tokenUsageArray.filter(entry => {
            // First try the date field
            let entryDate = entry.date ? new Date(entry.date) : null;
            
            // If date is not valid, try timestamp
            if (!entryDate || isNaN(entryDate.getTime())) {
                entryDate = entry.timestamp ? new Date(entry.timestamp) : null;
            }

            // Skip entries with no valid date
            if (!entryDate || isNaN(entryDate.getTime())) {
                console.warn('Entry skipped - no valid date:', entry);
                return false;
            }

            const isInRange = entryDate >= firstDayOfMonth && entryDate <= now;
            
            // Debug first few entries
            if (tokenUsageArray.indexOf(entry) < 3) {
                console.log('Entry date check:', {
                    date: entryDate,
                    firstDayOfMonth,
                    now,
                    isInRange
                });
            }

            return isInRange;
        });

        console.log("Filtering results:", {
            firstDayOfMonth: firstDayOfMonth.toISOString(),
            now: now.toISOString(),
            totalEntries: tokenUsageArray.length,
            filteredEntries: tokenUsageData.length
        });

        const result = {
            totals: {},
            daily: {},
            totalCost: 0,
            currentCreditAmount: userBilling.creditBalance,
            tokenUsage: []
        };

        tokenUsageData.forEach(entry => {
            const { modelName, inputTokens, outputTokens } = entry;
            
            // Get date from either field
            const entryDate = entry.date ? new Date(entry.date) : new Date(entry.timestamp);
            const dateStr = entryDate.toISOString().split('T')[0];

            if (!modelCosts[modelName]) {
                console.warn(`Unknown model encountered: ${modelName}`);
                return;
            }

            const { inputTokenCost, outputTokenCost } = modelCosts[modelName];

            // Initialize model totals
            if (!result.totals[modelName]) {
                result.totals[modelName] = {
                    inputTokens: 0,
                    outputTokens: 0,
                    inputTokenCost: 0,
                    outputTokenCost: 0,
                    totalCost: 0
                };
            }

            // Initialize daily totals
            if (!result.daily[dateStr]) {
                result.daily[dateStr] = {};
            }
            if (!result.daily[dateStr][modelName]) {
                result.daily[dateStr][modelName] = {
                    inputTokens: 0,
                    outputTokens: 0,
                    inputTokenCost: 0,
                    outputTokenCost: 0,
                    totalCost: 0
                };
            }

            // Calculate costs
            const inputCost = inputTokens * inputTokenCost;
            const outputCost = outputTokens * outputTokenCost;
            const totalCost = inputCost + outputCost;

            // Update totals
            result.totals[modelName].inputTokens += inputTokens;
            result.totals[modelName].outputTokens += outputTokens;
            result.totals[modelName].inputTokenCost += inputCost;
            result.totals[modelName].outputTokenCost += outputCost;
            result.totals[modelName].totalCost += totalCost;

            // Update daily totals
            result.daily[dateStr][modelName].inputTokens += inputTokens;
            result.daily[dateStr][modelName].outputTokens += outputTokens;
            result.daily[dateStr][modelName].inputTokenCost += inputCost;
            result.daily[dateStr][modelName].outputTokenCost += outputCost;
            result.daily[dateStr][modelName].totalCost += totalCost;

            result.totalCost += totalCost;

            // Add to token usage array
            result.tokenUsage.push({
                modelName,
                inputTokens,
                outputTokens,
                inputCost,
                outputCost,
                totalCost,
                date: dateStr
            });
        });

        // Format numbers
        Object.keys(result.totals).forEach(modelName => {
            result.totals[modelName].inputTokenCost = Number(result.totals[modelName].inputTokenCost.toFixed(2));
            result.totals[modelName].outputTokenCost = Number(result.totals[modelName].outputTokenCost.toFixed(2));
            result.totals[modelName].totalCost = Number(result.totals[modelName].totalCost.toFixed(2));
        });

        Object.keys(result.daily).forEach(dateStr => {
            Object.keys(result.daily[dateStr]).forEach(modelName => {
                result.daily[dateStr][modelName].inputTokenCost = Number(result.daily[dateStr][modelName].inputTokenCost.toFixed(2));
                result.daily[dateStr][modelName].outputTokenCost = Number(result.daily[dateStr][modelName].outputTokenCost.toFixed(2));
                result.daily[dateStr][modelName].totalCost = Number(result.daily[dateStr][modelName].totalCost.toFixed(2));
            });
        });

        result.totalCost = Number(result.totalCost.toFixed(2));

        return res.status(200).json(result);
    } catch (error) {
        console.error("Token usage calculation error:", error);
        return res.status(500).send("Server error");
    }
};

