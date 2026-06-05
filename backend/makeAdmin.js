require('dotenv').config();
const mongoose = require('mongoose');
const Merchant = require('./models/Merchant');

const makeAdmin = async () => {
  const email = process.argv[2];
  
  if (!email) {
    console.error('Please provide an email address as an argument.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await Merchant.findOne({ email });
    if (!user) {
      console.error(`User with email ${email} not found.`);
      process.exit(1);
    }

    user.role = 'super_admin';
    await user.save();
    console.log(`Successfully updated ${email} to super_admin!`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

makeAdmin();
