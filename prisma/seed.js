const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    // Check if admin user already exists
    const existingAdmin = await prisma.user.findUnique({
        where: { email: 'admin@nyu.edu' }
    });

    if (!existingAdmin) {
        // Create admin user
        const hashedPassword = await bcrypt.hash('123', 10);
        await prisma.user.create({
            data: {
                email: 'admin@nyu.edu',
                name: 'Admin',
                systemRole: 'admin', // Using systemRole instead of role
                oauth: false, // Not an OAuth login
                password: hashedPassword,
                consent: true
            },
        });
        console.log('Admin user created successfully');
    } else {
        console.log('Admin user already exists');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    }); 