const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/live-chat-system';
console.log('Connecting to:', MONGODB_URI);

const Merchant = require('./models/Merchant');

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected!');
    
    // Find merchants that have widgets with authorized users
    const merchants = await Merchant.find({ 'widgets.authorizedUsers': { $exists: true, $not: { $size: 0 } } });
    console.log(`Found ${merchants.length} merchants with agents.`);
    
    for (const m of merchants) {
      console.log(`\nMerchant: ${m.name} (${m.email})`);
      for (const w of m.widgets) {
        console.log(`  Widget: ${w.companyName} (${w.domain})`);
        console.log(`    AuthorizedUsers:`, JSON.stringify(w.authorizedUsers, null, 2));
        
        // Let's manually populate and check
        const populated = await Merchant.findById(m._id).populate("widgets.authorizedUsers.user", "name email");
        const populatedWidget = populated.widgets.find(pw => pw._id.toString() === w._id.toString());
        console.log(`    Populated AuthorizedUsers:`, JSON.stringify(populatedWidget.authorizedUsers, null, 2));
      }
    }
    
    // Let's also check if user ID "6a5521d619a0b63293f2650d" exists in the DB
    const targetUserId = '6a5521d619a0b63293f2650d';
    if (mongoose.Types.ObjectId.isValid(targetUserId)) {
      const foundUser = await Merchant.findById(targetUserId);
      console.log(`\nSearching for user ID ${targetUserId} in merchants collection:`, foundUser ? `FOUND: ${foundUser.name} (${foundUser.email})` : 'NOT FOUND');
      
      const Admin = require('./models/Admin');
      const foundAdmin = await Admin.findById(targetUserId);
      console.log(`Searching for user ID ${targetUserId} in admins collection:`, foundAdmin ? `FOUND ADMIN: ${foundAdmin.username || foundAdmin.email}` : 'NOT FOUND');
    } else {
      console.log(`\nID ${targetUserId} is NOT a valid ObjectId!`);
    }

    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error:', err);
  });
