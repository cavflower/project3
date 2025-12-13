"""
測試取餐號碼生成
"""
import random

def generate_pickup_number():
    """模擬生成取餐號碼"""
    random_number = random.randint(1, 1000)
    return str(random_number)

# 生成 20 個測試號碼
print("生成 20 個隨機取餐號碼（範圍 1-1000）：\n")
for i in range(20):
    number = generate_pickup_number()
    print(f"{i+1:2d}. 取餐號碼：{number}")

print("\n✓ 取餐號碼格式：純數字 1-1000")
print("✓ 每次生成都是隨機的")
print("✓ 顧客只需記住這個數字即可")
