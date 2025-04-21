"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ClassInfo {
  title: string;
  code: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
}

const classes: ClassInfo[] = [
  { title: "Introduction to Computer Programming", code: "CSCI-SHU 11" },
  { title: "Introduction to Computer and Data Science", code: "CSCI-SHU 101" },
  { title: "Data Structures", code: "CSCI-SHU 210" },
  { title: "Algorithms", code: "CSCI-SHU 220" },
  { title: "Machine Learning", code: "CSCI-SHU 360" },
  { title: "Operating Systems", code: "CSCI-SHU 370" },
];

const containerStyle: React.CSSProperties = {
  padding: '2%',
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #f5f7fa, #c3cfe2)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const innerContainerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  width: '100%',
};

const headerStyle: React.CSSProperties = {
  marginBottom: '2rem',
  textAlign: 'center',
};

const userInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '1rem',
};

const profileStyle: React.CSSProperties = {
  width: '100px',
  height: '100px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #FFC9B3, #FFD2C2)',
  border: '5px solid #fff',
  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
  marginRight: '1rem',
};

const usernameStyle: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 600,
  color: '#333',
};

const titleStyle: React.CSSProperties = {
  color: '#673AB8',
  fontSize: '2.5rem',
  margin: 0,
  fontFamily: 'Arial, sans-serif',
};

const gridContainerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '1rem',
  gridAutoRows: '250px', // Each row has a fixed height
};

const cardStyle: React.CSSProperties = {
  height: '100%', // Ensures card fills the grid cell height
  border: 'none',
  borderRadius: '12px',
  padding: '1.5rem',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  background: '#fff',
  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
};

const cardTitleStyle: React.CSSProperties = {
  color: '#1C1C1C',
  fontSize: '1.8rem',
  marginBottom: '0.5rem',
  fontFamily: 'Georgia, serif',
};

const cardCodeStyle: React.CSSProperties = {
  color: '#555',
  fontSize: '1.2rem',
  marginBottom: '1rem',
  fontFamily: 'Arial, sans-serif',
};

const buttonStyle: React.CSSProperties = {
  background: '#21262D',
  border: 'none',
  borderRadius: '8px',
  padding: '0.7rem 1.2rem',
  color: '#C9D1D9',
  textAlign: 'center',
  cursor: 'pointer',
  alignSelf: 'flex-start',
  transition: 'background 0.2s ease',
};

const footerStyle: React.CSSProperties = {
  marginTop: '2rem',
  textAlign: 'center',
};

const imageStyle: React.CSSProperties = {
  maxWidth: '100%',
  height: 'auto',
};

const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
  const target = e.currentTarget as HTMLDivElement;
  target.style.transform = 'translateY(-5px)';
  target.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
};

const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
  const target = e.currentTarget as HTMLDivElement;
  target.style.transform = 'translateY(0)';
  target.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)';
};

const ProfilePage: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user information from session when component mounts
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/user/profile');
        if (!response.ok) {
          // If not authenticated, redirect to login page
          router.push('/login');
          return;
        }

        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error('Error fetching user info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, [router]);

  // Handle Get Started button click
  const handleGetStarted = (classInfo: ClassInfo) => {
    // Navigate to chat page with class info as query parameters
    router.push(`/chat?class=${encodeURIComponent(classInfo.title)}&code=${encodeURIComponent(classInfo.code)}`);
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={innerContainerStyle}>
          <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={innerContainerStyle}>
        <header style={headerStyle}>
          <div style={userInfoStyle}>
            <div style={profileStyle} />
            <div style={usernameStyle}>{user?.name || 'User'}</div>
          </div>
          <h2 style={titleStyle}>Your Classes</h2>
        </header>
        <div style={gridContainerStyle}>
          {classes.map((cls, idx) => (
            <div
              key={idx}
              style={cardStyle}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div>
                <h1 style={cardTitleStyle}>{cls.title}</h1>
                <p style={cardCodeStyle}>{cls.code}</p>
              </div>
              <div
                style={buttonStyle}
                onClick={() => handleGetStarted(cls)}
                className="hover:bg-gray-700"
              >
                Get Started
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
