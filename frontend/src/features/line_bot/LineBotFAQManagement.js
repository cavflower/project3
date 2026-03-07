import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllFAQs, createFAQ, updateFAQ, deleteFAQ, getPopularFAQs } from '../../api/lineBotApi';
import styles from './LineBotFAQManagement.module.css';

const LineBotFAQManagement = () => {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState([]);
  const [popularFaqs, setPopularFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    keywords: [],
    priority: 0,
    is_active: true,
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'popular'

  useEffect(() => {
    fetchFAQs();
    fetchPopularFAQs();
  }, []);

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const data = await getAllFAQs();
      setFaqs(data);
    } catch (error) {
      console.error('載入 FAQ 失敗:', error);
      alert('載入 FAQ 失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const fetchPopularFAQs = async () => {
    try {
      const data = await getPopularFAQs();
      setPopularFaqs(data);
    } catch (error) {
      console.error('載入熱門 FAQ 失敗:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.question || !formData.answer) {
      alert('請填寫問題和答案');
      return;
    }

    try {
      if (editingFaq) {
        // 更新現有 FAQ
        await updateFAQ(editingFaq.id, formData);
        alert('FAQ 更新成功！');
      } else {
        // 建立新 FAQ
        await createFAQ(formData);
        alert('FAQ 建立成功！');
      }

      // 重新載入資料
      fetchFAQs();
      fetchPopularFAQs();

      // 重置表單
      resetForm();
    } catch (error) {
      console.error('儲存 FAQ 失敗:', error);
      alert('儲存 FAQ 失敗，請稍後再試');
    }
  };

  const handleEdit = (faq) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      keywords: faq.keywords || [],
      priority: faq.priority,
      is_active: faq.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除這個 FAQ 嗎？')) {
      return;
    }

    try {
      await deleteFAQ(id);
      alert('FAQ 刪除成功！');
      fetchFAQs();
      fetchPopularFAQs();
    } catch (error) {
      console.error('刪除 FAQ 失敗:', error);
      alert('刪除 FAQ 失敗，請稍後再試');
    }
  };

  const resetForm = () => {
    setFormData({
      question: '',
      answer: '',
      keywords: [],
      priority: 0,
      is_active: true,
    });
    setKeywordInput('');
    setEditingFaq(null);
    setShowForm(false);
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.keywords.includes(keywordInput.trim())) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, keywordInput.trim()],
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter((k) => k !== keyword),
    });
  };

  const handleKeywordInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  if (loading) {
    return <div className={styles.loading}>載入中...</div>;
  }

  return (
    <div className={styles.linebotFaqManagement}>
      <div className={styles.faqHeader}>
        <div>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/merchant/line-bot')}
            style={{ marginRight: '10px' }}
          >
            ← 返回設定
          </button>
          <h2 style={{ display: 'inline-block', marginLeft: '10px' }}>🤖 LINE BOT FAQ 管理</h2>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '取消' : '+ 新增 FAQ'}
        </button>
      </div>

      {showForm && (
        <div className={styles.faqFormContainer}>
          <h3>{editingFaq ? '編輯 FAQ' : '新增 FAQ'}</h3>
          <form onSubmit={handleSubmit} className="faq-form">
            <div className={styles.formGroup}>
              <label>問題 *</label>
              <input
                type="text"
                value={formData.question}
                onChange={(e) =>
                  setFormData({ ...formData, question: e.target.value })
                }
                placeholder="例如：你們的營業時間是？"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>答案 *</label>
              <textarea
                value={formData.answer}
                onChange={(e) =>
                  setFormData({ ...formData, answer: e.target.value })
                }
                placeholder="提供詳細的回答..."
                rows="4"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>關鍵字（用於匹配用戶問題）</label>
              <div className={styles.keywordInputGroup}>
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyPress={handleKeywordInputKeyPress}
                  placeholder="輸入關鍵字後按 Enter"
                />
                <button
                  type="button"
                  onClick={addKeyword}
                  className="btn btn-secondary"
                >
                  新增
                </button>
              </div>
              <div className={styles.keywordsList}>
                {formData.keywords.map((keyword, index) => (
                  <span key={index} className="keyword-tag">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      className={styles.removeKeyword}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>優先順序</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                />
                <small>數字越大優先級越高</small>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                  />
                  啟用此 FAQ
                </label>
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="submit" className="btn btn-primary">
                {editingFaq ? '更新' : '建立'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.faqTabs}>
        <button
          className={activeTab === 'all' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('all')}
        >
          所有 FAQ ({faqs.length})
        </button>
        <button
          className={activeTab === 'popular' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('popular')}
        >
          熱門 FAQ ({popularFaqs.length})
        </button>
      </div>

      <div className={styles.faqList}>
        {activeTab === 'all' && faqs.length === 0 && (
          <div className={styles.emptyState}>
            <p>尚未建立任何 FAQ</p>
            <p>點擊「新增 FAQ」開始建立常見問題</p>
          </div>
        )}

        {activeTab === 'popular' && popularFaqs.length === 0 && (
          <div className={styles.emptyState}>
            <p>尚無熱門 FAQ 資料</p>
          </div>
        )}

        {(activeTab === 'all' ? faqs : popularFaqs).map((faq) => (
          <div
            key={faq.id}
            className={faq.is_active ? styles.faqItem : styles.faqItemInactive}
          >
            <div className={styles.faqHeaderRow}>
              <div className={styles.faqPriority}>優先級: {faq.priority}</div>
              {faq.usage_count > 0 && (
                <div className={styles.faqUsage}>使用次數: {faq.usage_count}</div>
              )}
              {!faq.is_active && <div className={styles.faqStatus}>已停用</div>}
            </div>

            <div className={styles.faqQuestion}>
              <strong>問題：</strong>
              {faq.question}
            </div>

            <div className={styles.faqAnswer}>
              <strong>答案：</strong>
              {faq.answer}
            </div>

            {faq.keywords && faq.keywords.length > 0 && (
              <div className={styles.faqKeywords}>
                <strong>關鍵字：</strong>
                {faq.keywords.map((keyword, index) => (
                  <span key={index} className="keyword-tag">
                    {keyword}
                  </span>
                ))}
              </div>
            )}

            <div className={styles.faqActions}>
              <button
                onClick={() => handleEdit(faq)}
                className="btn btn-edit"
              >
                編輯
              </button>
              <button
                onClick={() => handleDelete(faq.id)}
                className="btn btn-delete"
              >
                刪除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LineBotFAQManagement;
