// cron job to run every start of the month to check
// if user has existing credits

import cron from 'node-cron';
import { UserBillingModel } from '../Usage/schema/tokenSchema.mjs';


cron.schedule('0 0 1 * *', async () => { // Runs on the first day of every month
    const userBillings = await UserBillingModel.find({});
    
    for (const billing of userBillings) {
      billing.carriedForwardCredit += billing.creditBalance;
      billing.creditBalance = 0; // Reset purchased credits after carrying forward
      billing.monthlyUsage = 0; // Reset monthly usage
      await billing.save();
    }
  });

  
