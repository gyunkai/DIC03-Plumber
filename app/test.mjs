import prisma from './lib/prisma';



async function testCreateUser() {
    try {
        const newUser = await prisma.user.create({
            data: {
                name: "Test User",
                email: "test@example.com",
                password: "hashedpassword123",
                oauth: false,
                id: "2",
            },
        });

        console.log("✅ User created successfully:", newUser);
    } catch (error) {
        console.error("❌ Error creating user:", error);
    } finally {
        await prisma.$disconnect(); // 断开数据库连接，防止进程挂起
    }
}

// 运行测试
testCreateUser();
